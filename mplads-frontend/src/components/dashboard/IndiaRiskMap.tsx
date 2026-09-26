import { useState, useEffect, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePortalBase } from "../../lib/usePortalBase";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
  useMap,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  ChevronRight,
  AlertTriangle,
  RotateCcw,
  Compass,
} from "lucide-react";
import Card from "../ui/Card";
import Select from "../ui/Select";
import Button from "../ui/Button";
import { RiskBadge } from "../ui/Badge";
import { formatINR } from "../../lib/format";
import { ALL_CATEGORIES, DISTRICTS_BY_STATE } from "../../data/geography";
import type { Project, StateRiskData } from "../../types";

// Official geographic centers for India states
const STATE_COORDINATES: Record<string, [number, number]> = {
  Maharashtra: [19.75, 75.71],
  Gujarat: [22.26, 71.19],
  Karnataka: [15.32, 75.71],
  Rajasthan: [27.02, 74.22],
  "Madhya Pradesh": [22.97, 78.66],
  "Uttar Pradesh": [26.85, 80.95],
  "Tamil Nadu": [11.13, 78.66],
  Punjab: [31.15, 75.34],
  "West Bengal": [22.99, 87.85],
  Bihar: [25.1, 85.31],
};

// 100% Free ESRI Tile Providers — NO API KEY REQUIRED, NO WATERMARKS
const MAP_STYLES: Record<string, { name: string; url: string; attribution: string }> = {
  street: {
    name: "Street Map",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, DeLorme, NAVTEQ, USGS',
  },
  satellite: {
    name: "Satellite / Aerial",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, Earthstar Geographics',
  },
  topo: {
    name: "Topographic",
    url: "https://server.arcgisonline.com/ArcGIS/rest/services/World_Topo_Map/MapServer/tile/{z}/{y}/{x}",
    attribution: '&copy; <a href="https://www.esri.com/">Esri</a>, USGS, Intermap',
  },
};

const CATEGORY_ABBREV: Record<string, string> = {
  Road: "RD",
  "Community Hall": "CH",
  "School Infrastructure": "SCH",
  "Drinking Water": "DW",
  Sanitation: "SAN",
  Healthcare: "HLT",
  "Street Lighting": "SL",
  "Public Infrastructure": "PI",
};

const RISK_SIGNAL_OPTIONS = [
  { value: "All", label: "All Risk Categories" },
  { value: "Cost Anomaly", label: "Cost Anomaly (Outlier/Z-Score)" },
  { value: "Duplicate Work", label: "Duplicate / Ghost Work (NLP)" },
  { value: "Delay Risk", label: "Delay / Progress Lag" },
  { value: "Satellite Verification", label: "Satellite Physical Discrepancy" },
  { value: "Citizen Signal", label: "Citizen Grievance Signal" },
];

// Helper to determine primary risk category for each project
function getPrimaryRiskCategory(p: Project): { name: string; tag: string; detail: string } {
  if (p.costZScore && p.costZScore >= 1.5) {
    return {
      name: "Cost Anomaly",
      tag: `Z-Score +${Number(p.costZScore).toFixed(1)}σ`,
      detail: `Cost exceeds peer benchmark by ${Math.round(((p.expenditure - p.peerAverageCost) / p.peerAverageCost) * 100)}%`,
    };
  }
  if (p.similarityScore && p.similarityScore >= 70) {
    return {
      name: "Duplicate Work",
      tag: `${p.similarityScore}% NLP Match`,
      detail: `Semantic overlap with ${p.similarProjectId || "adjacent work"}`,
    };
  }
  if (p.riskFactors.satelliteVerification === "Review" || (p.satelliteRiskScore && p.satelliteRiskScore > 40)) {
    return {
      name: "Satellite Verification",
      tag: "Imagery Discrepancy",
      detail: p.satelliteStatus || "Physical verification recommended based on earth observation",
    };
  }
  if (p.expectedProgress - p.physicalProgress > 15 || p.status === "Delayed") {
    return {
      name: "Delay Risk",
      tag: `${p.expectedProgress - p.physicalProgress}% Lag`,
      detail: "Physical progress lagging significantly behind expected milestone",
    };
  }
  if (p.citizenReportCount && p.citizenReportCount > 0) {
    return {
      name: "Citizen Signal",
      tag: `${p.citizenReportCount} Citizen Reports`,
      detail: "Community-submitted grievance alerts on ground progress",
    };
  }
  if (p.riskFactors.costAnomaly === "High" || p.riskFactors.costAnomaly === "Critical") {
    return {
      name: "Cost Anomaly",
      tag: "High Deviation",
      detail: "Expenditure pattern deviates from expected cost envelope",
    };
  }
  return {
    name: "Multi-Signal Review",
    tag: `${p.riskScore}/100 Risk`,
    detail: p.flagReason || "Multi-signal risk score exceeds monitoring threshold",
  };
}

// Custom Leaflet DivIcon generator
function createRiskMarkerIcon(p: Project, isSelected: boolean) {
  const isCritical = p.riskLevel === "Critical";
  const isHigh = p.riskLevel === "High";
  const isMedium = p.riskLevel === "Medium";

  const color = isCritical
    ? "#dc2626"
    : isHigh
    ? "#ea580c"
    : isMedium
    ? "#d97706"
    : "#16a34a";

  const abbrev = CATEGORY_ABBREV[p.category] || "PRJ";

  const html = `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 34px; height: 34px; cursor: pointer;">
      ${
        isCritical
          ? `<span style="position: absolute; width: 36px; height: 36px; border-radius: 9999px; background-color: ${color}; opacity: 0.35; animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>`
          : ""
      }
      <div style="
        width: 30px;
        height: 30px;
        border-radius: 9999px;
        background-color: ${color};
        color: white;
        border: 2px solid ${isSelected ? "#1e293b" : "white"};
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.25), 0 2px 4px -2px rgba(0, 0, 0, 0.25);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 9px;
        line-height: 1;
        transition: transform 0.15s ease-in-out;
        ${isSelected ? "transform: scale(1.25); border-width: 3px;" : ""}
      ">
        <span>${abbrev}</span>
        <span style="font-size: 7px; opacity: 0.9; font-weight: 700;">${p.riskScore}</span>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "custom-risk-marker",
    iconSize: [34, 34],
    iconAnchor: [17, 17],
    popupAnchor: [0, -18],
  });
}

// Controller to smoothly pan & zoom map when state or project changes
function MapFlyController({
  targetCoords,
  zoom,
}: {
  targetCoords: [number, number] | null;
  zoom: number;
}) {
  const map = useMap();
  useEffect(() => {
    if (targetCoords) {
      map.flyTo(targetCoords, zoom, { duration: 1.2 });
    }
  }, [targetCoords, zoom, map]);
  return null;
}

export default function IndiaRiskMap({
  projects = [],
  height = "h-[540px]",
  initialState = "All",
}: {
  data?: StateRiskData[];
  projects?: Project[];
  compact?: boolean;
  height?: string;
  initialState?: string;
}) {
  const navigate = useNavigate();
  const portalBase = usePortalBase();

  // Filters
  const [selectedState, setSelectedState] = useState<string>(initialState);
  const [selectedCategory, setSelectedCategory] = useState<string>("All");
  const [selectedRiskLevel, setSelectedRiskLevel] = useState<string>("All");
  const [selectedRiskSignal, setSelectedRiskSignal] = useState<string>("All");

  // Map state
  const [mapStyle, setMapStyle] = useState<"street" | "satellite" | "topo">("street");
  const [focusedCoords, setFocusedCoords] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(5);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  // Filter projects by location, category, risk level, and risk signal
  const filteredProjects = useMemo(() => {
    return projects.filter((p) => {
      if (selectedState !== "All" && p.state !== selectedState) return false;
      if (selectedCategory !== "All" && p.category !== selectedCategory) return false;
      if (selectedRiskLevel !== "All" && p.riskLevel !== selectedRiskLevel) return false;

      if (selectedRiskSignal !== "All") {
        const signal = getPrimaryRiskCategory(p).name;
        if (selectedRiskSignal === "Cost Anomaly" && signal !== "Cost Anomaly") return false;
        if (selectedRiskSignal === "Duplicate Work" && signal !== "Duplicate Work") return false;
        if (selectedRiskSignal === "Delay Risk" && signal !== "Delay Risk") return false;
        if (selectedRiskSignal === "Satellite Verification" && signal !== "Satellite Verification") return false;
        if (selectedRiskSignal === "Citizen Signal" && signal !== "Citizen Signal") return false;
      }

      return true;
    });
  }, [projects, selectedState, selectedCategory, selectedRiskLevel, selectedRiskSignal]);

  // When state filter changes, fly map to that state
  function handleStateChange(stateName: string) {
    setSelectedState(stateName);
    setSelectedProject(null);
    if (stateName === "All") {
      setFocusedCoords([22.5, 79.5]);
      setMapZoom(5);
    } else if (STATE_COORDINATES[stateName]) {
      setFocusedCoords(STATE_COORDINATES[stateName]);
      setMapZoom(7);
    }
  }

  function handleResetFilters() {
    setSelectedState("All");
    setSelectedCategory("All");
    setSelectedRiskLevel("All");
    setSelectedRiskSignal("All");
    setSelectedProject(null);
    setFocusedCoords([22.5, 79.5]);
    setMapZoom(5);
  }

  function handleSelectHotspot(p: Project) {
    setSelectedProject(p);
    setFocusedCoords([p.latitude, p.longitude]);
    setMapZoom(9);
  }

  const stateOptions = [
    { value: "All", label: "All India States" },
    ...Object.keys(DISTRICTS_BY_STATE).map((s) => ({ value: s, label: s })),
  ];

  const categoryOptions = [
    { value: "All", label: "All Work Categories" },
    ...ALL_CATEGORIES.map((c) => ({ value: c, label: c })),
  ];

  const riskLevelOptions = [
    { value: "All", label: "All Risk Levels" },
    { value: "Critical", label: "Critical (80-100)" },
    { value: "High", label: "High (60-79)" },
    { value: "Medium", label: "Medium (35-59)" },
    { value: "Low", label: "Low (< 35)" },
  ];

  return (
    <Card noPadding className="overflow-hidden border border-gray-200 shadow-sm">
      {/* Map Header */}
      <div className="p-4 sm:p-5 border-b border-gray-200 bg-white flex flex-col md:flex-row md:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-bold text-gray-900 tracking-tight flex items-center gap-2">
              <Compass size={18} className="text-navy-700" /> Real India Risk Surveillance Map
            </h3>
            <span className="bg-red-50 text-red-700 text-xs font-semibold px-2.5 py-0.5 rounded-full border border-red-200">
              {filteredProjects.length} Risk Points Located
            </span>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Geographic positioning of high-risk MPLADS works categorized by risk type and work domain
          </p>
        </div>

        {/* Legend */}
        <div className="flex items-center gap-3 text-xs flex-wrap">
          <span className="flex items-center gap-1.5 font-medium text-gray-700">
            <span className="w-3 h-3 rounded-full bg-red-600 ring-2 ring-red-200 animate-pulse" /> Critical
          </span>
          <span className="flex items-center gap-1.5 font-medium text-gray-700">
            <span className="w-3 h-3 rounded-full bg-orange-600" /> High
          </span>
          <span className="flex items-center gap-1.5 font-medium text-gray-700">
            <span className="w-3 h-3 rounded-full bg-amber-500" /> Medium
          </span>
          <span className="flex items-center gap-1.5 font-medium text-gray-700">
            <span className="w-3 h-3 rounded-full bg-emerald-600" /> Low
          </span>

          {/* Map Layer Switcher: Street / Satellite / Topo */}
          <div className="flex items-center bg-gray-100 p-0.5 rounded-lg text-xs border border-gray-200">
            {(["street", "satellite", "topo"] as const).map((style) => (
              <button
                key={style}
                onClick={() => setMapStyle(style)}
                className={`px-2 py-0.5 rounded-md font-medium text-[11px] transition-colors ${
                  mapStyle === style
                    ? "bg-white text-navy-900 shadow-sm"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {style === "street" ? "Street" : style === "satellite" ? "Satellite" : "Topo"}
              </button>
            ))}
          </div>

          <Button
            variant="outline"
            size="sm"
            icon={<RotateCcw size={13} />}
            onClick={handleResetFilters}
          >
            Reset
          </Button>
        </div>
      </div>

      {/* Map Interactive Filter Toolbar */}
      <div className="p-3 bg-gray-50 border-b border-gray-200">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          <Select
            placeholder="Select State"
            options={stateOptions}
            value={selectedState}
            onChange={(e) => handleStateChange(e.target.value)}
          />
          <Select
            placeholder="Select Work Category"
            options={categoryOptions}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          />
          <Select
            placeholder="Select Risk Category"
            options={RISK_SIGNAL_OPTIONS}
            value={selectedRiskSignal}
            onChange={(e) => setSelectedRiskSignal(e.target.value)}
          />
          <Select
            placeholder="Select Risk Level"
            options={riskLevelOptions}
            value={selectedRiskLevel}
            onChange={(e) => setSelectedRiskLevel(e.target.value)}
          />
        </div>
      </div>

      {/* Main Map Body Container */}
      <div className="relative">
        <div className={`w-full ${height} z-0 relative bg-slate-100`}>
          <MapContainer
            center={[22.5, 79.5]}
            zoom={5}
            minZoom={4}
            maxZoom={18}
            scrollWheelZoom={true}
            style={{ width: "100%", height: "100%" }}
          >
            {/* 100% Free ESRI Tiles — NO API KEY REQUIRED, NO WATERMARKS */}
            <TileLayer
              key={mapStyle}
              attribution={MAP_STYLES[mapStyle].attribution}
              url={MAP_STYLES[mapStyle].url}
              maxZoom={18}
            />

            {/* Smooth Pan & Zoom Controller */}
            <MapFlyController targetCoords={focusedCoords} zoom={mapZoom} />

            {/* Render markers for each filtered project */}
            {filteredProjects.map((p) => {
              const riskInfo = getPrimaryRiskCategory(p);
              const isSelected = selectedProject?.id === p.id;

              return (
                <Marker
                  key={p.id}
                  position={[p.latitude, p.longitude]}
                  icon={createRiskMarkerIcon(p, isSelected)}
                  eventHandlers={{
                    click: () => {
                      setSelectedProject(p);
                    },
                  }}
                >
                  <Tooltip direction="top" offset={[0, -20]} opacity={0.95}>
                    <div className="text-xs font-semibold">
                      <span className="text-navy-900 font-bold">{p.id}</span> • {p.district}
                      <div className="text-[11px] text-gray-600 font-normal">
                        {p.category} | {riskInfo.name} ({p.riskScore}/100)
                      </div>
                    </div>
                  </Tooltip>

                  <Popup className="custom-risk-popup">
                    <div className="p-1 space-y-2 min-w-[260px] max-w-[320px]">
                      {/* Popup Header */}
                      <div className="flex items-center justify-between gap-2 border-b border-gray-100 pb-1.5">
                        <div className="flex items-center gap-1.5">
                          <span className="font-mono text-xs font-bold text-navy-800 bg-navy-50 px-1.5 py-0.5 rounded">
                            {p.id}
                          </span>
                          <span className="text-[10px] font-semibold bg-gray-100 text-gray-700 px-1.5 py-0.5 rounded">
                            {p.category}
                          </span>
                        </div>
                        <RiskBadge level={p.riskLevel} size="sm" />
                      </div>

                      {/* Project Name & Location */}
                      <div>
                        <h4 className="text-xs font-bold text-gray-900 line-clamp-2 leading-snug">
                          {p.name}
                        </h4>
                        <p className="text-[11px] text-gray-500 flex items-center gap-1 mt-0.5">
                          <MapPin size={11} /> {p.district}, {p.state}
                        </p>
                      </div>

                      {/* Which Category Risk */}
                      <div className="bg-red-50/70 border border-red-200/80 rounded-md p-2 space-y-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className="font-bold text-red-900 flex items-center gap-1">
                            <AlertTriangle size={12} className="text-red-600" />
                            {riskInfo.name}
                          </span>
                          <span className="font-mono text-[10px] font-bold text-red-700 bg-white px-1 rounded border border-red-200">
                            {riskInfo.tag}
                          </span>
                        </div>
                        <p className="text-[11px] text-red-800 leading-tight">
                          {riskInfo.detail}
                        </p>
                      </div>

                      {/* Sanction & Progress */}
                      <div className="grid grid-cols-2 gap-1 text-[11px] pt-1 text-gray-600">
                        <div>
                          <span className="text-gray-400 block text-[10px]">Sanction Amount</span>
                          <span className="font-semibold text-gray-800">{formatINR(p.sanctionedAmount)}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block text-[10px]">Physical Progress</span>
                          <span className="font-semibold text-gray-800">{p.physicalProgress}%</span>
                        </div>
                      </div>

                      {/* Action Button */}
                      <div className="pt-2 border-t border-gray-100">
                        <button
                          onClick={() => navigate(`${portalBase}/projects/${encodeURIComponent(p.id)}`)}
                          className="w-full py-1.5 bg-navy-700 hover:bg-navy-800 text-white rounded text-xs font-semibold transition-colors flex items-center justify-center gap-1 shadow-sm"
                        >
                          View Full Project Dossier
                          <ChevronRight size={13} />
                        </button>
                      </div>
                    </div>
                  </Popup>
                </Marker>
              );
            })}
          </MapContainer>
        </div>

        {/* Hotspots Quick Tray / Drawer */}
        <div className="p-3 bg-white border-t border-gray-200 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-xs text-gray-600">
            <span className="font-semibold text-gray-900">Active Hotspots:</span>
            <span>Click any location pin or card to inspect supervisory risk metrics.</span>
          </div>
          <div className="flex items-center gap-2 overflow-x-auto max-w-full pb-1">
            {filteredProjects.slice(0, 5).map((p) => {
              const riskInfo = getPrimaryRiskCategory(p);
              return (
                <button
                  key={p.id}
                  onClick={() => handleSelectHotspot(p)}
                  className={`text-left shrink-0 px-2.5 py-1 rounded border text-xs transition-all ${
                    selectedProject?.id === p.id
                      ? "bg-navy-800 text-white border-navy-800 shadow"
                      : "bg-gray-50 text-gray-800 hover:bg-gray-100 border-gray-200"
                  }`}
                >
                  <div className="flex items-center gap-1.5">
                    <span className="font-mono font-bold text-[10px]">{p.id}</span>
                    <span
                      className={`w-1.5 h-1.5 rounded-full ${
                        p.riskLevel === "Critical"
                          ? "bg-red-500"
                          : p.riskLevel === "High"
                          ? "bg-orange-500"
                          : "bg-amber-500"
                      }`}
                    />
                    <span className="font-medium text-[11px] truncate max-w-[90px]">{p.district}</span>
                  </div>
                  <div className="text-[10px] opacity-80 mt-0.5 truncate max-w-[130px]">
                    {p.category} • {riskInfo.name}
                  </div>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </Card>
  );
}
