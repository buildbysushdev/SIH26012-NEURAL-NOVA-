import { useEffect, useState, useMemo } from "react";
import { useSearchParams, useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Marker,
  Popup,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import {
  MapPin,
  RotateCcw,
  Compass,
  Building2,
  FolderKanban,
  ShieldAlert,
  IndianRupee,
} from "lucide-react";
import Card from "../components/ui/Card";
import Select from "../components/ui/Select";
import Button from "../components/ui/Button";
import { RiskBadge } from "../components/ui/Badge";
import IndiaRiskMap from "../components/dashboard/IndiaRiskMap";
import { getRiskMapData, getProjects } from "../services/api";
import { useAuth } from "../context/AuthContext";
import { usePortalBase } from "../lib/usePortalBase";
import { DISTRICTS_BY_STATE, ALL_CATEGORIES } from "../data/geography";
import type { StateRiskData, Project } from "../types";

// State Coordinates for map centering
const STATE_COORDINATES: Record<string, [number, number]> = {
  Maharashtra: [19.75, 75.71],
  Karnataka: [15.32, 75.71],
  "Uttar Pradesh": [26.85, 80.95],
  Rajasthan: [27.02, 74.22],
  Gujarat: [22.26, 71.19],
  "Madhya Pradesh": [22.97, 78.66],
  "Tamil Nadu": [11.13, 78.66],
  Punjab: [31.15, 75.34],
  "West Bengal": [22.99, 87.85],
  Bihar: [25.1, 85.31],
};

function createMarkerIcon(p: Project, isSelected: boolean) {
  const color =
    p.riskLevel === "Critical"
      ? "#dc2626"
      : p.riskLevel === "High"
      ? "#ea580c"
      : p.riskLevel === "Medium"
      ? "#d97706"
      : "#16a34a";

  const html = `
    <div style="position: relative; display: flex; align-items: center; justify-content: center; width: 32px; height: 32px; cursor: pointer;">
      <div style="
        width: 28px;
        height: 28px;
        border-radius: 9999px;
        background-color: ${color};
        color: white;
        border: 2px solid ${isSelected ? "#1e293b" : "white"};
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.3);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        font-weight: 800;
        font-size: 9px;
      ">
        <span>${p.riskScore}</span>
      </div>
    </div>
  `;

  return L.divIcon({
    html,
    className: "state-risk-marker",
    iconSize: [32, 32],
    iconAnchor: [16, 16],
    popupAnchor: [0, -16],
  });
}

export default function RiskMap() {
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const portalBase = usePortalBase();
  const { user } = useAuth();
  const isOfficer = user?.role === "officer";
  const assignedState = user?.assignedState || "Maharashtra";

  // Data for Super Admin view
  const [adminMapData, setAdminMapData] = useState<StateRiskData[] | null>(null);
  const [adminProjects, setAdminProjects] = useState<Project[] | null>(null);

  // Officer-specific filters (locked to assignedState)
  const [selectedDistrict, setSelectedDistrict] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedRiskLevel, setSelectedRiskLevel] = useState("All");
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);

  useEffect(() => {
    getRiskMapData().then(setAdminMapData).catch(() => setAdminMapData([]));
    getProjects({ state: isOfficer ? assignedState : "", pageSize: 300 })
      .then((res) => setAdminProjects(res.data))
      .catch(() => setAdminProjects([]));
  }, [isOfficer, assignedState]);

  // Projects strictly scoped to officer's assigned state
  const stateProjects = useMemo(() => {
    return (adminProjects || []).filter((p) => p.state.toLowerCase() === assignedState.toLowerCase());
  }, [assignedState, adminProjects]);

  // Filtered state projects for the officer map
  const filteredStateProjects = useMemo(() => {
    return stateProjects.filter((p) => {
      const matchDistrict = selectedDistrict === "All" || p.district.toLowerCase() === selectedDistrict.toLowerCase();
      const matchCategory = selectedCategory === "All" || p.category === selectedCategory;
      const matchRisk = selectedRiskLevel === "All" || p.riskLevel === selectedRiskLevel;
      return matchDistrict && matchCategory && matchRisk;
    });
  }, [stateProjects, selectedDistrict, selectedCategory, selectedRiskLevel]);

  // District breakdown metrics for the officer's assigned state
  const districtBreakdown = useMemo(() => {
    const districts = DISTRICTS_BY_STATE[assignedState] || [];
    return districts.map((dist) => {
      const projs = stateProjects.filter((p) => p.district.toLowerCase() === dist.toLowerCase());
      const highRisk = projs.filter((p) => p.riskLevel === "High" || p.riskLevel === "Critical").length;
      const avgScore = projs.length > 0 ? Math.round(projs.reduce((acc, p) => acc + p.riskScore, 0) / projs.length) : 0;
      const totalSanctioned = projs.reduce((acc, p) => acc + p.sanctionedAmount, 0);
      const totalExp = projs.reduce((acc, p) => acc + p.expenditure, 0);
      const utilization = totalSanctioned > 0 ? Math.round((totalExp / totalSanctioned) * 100) : 0;
      return {
        district: dist,
        count: projs.length,
        highRisk,
        avgScore,
        utilization,
      };
    });
  }, [stateProjects, assignedState]);

  const stateCoords = STATE_COORDINATES[assignedState] || [19.75, 75.71];

  // ---------------- SUPER ADMIN VIEW (India Risk Map) ----------------
  if (!isOfficer) {
    return (
      <div className="space-y-5 animate-fade-in pb-10">
        <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800 rounded-md p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <Compass size={18} className="text-[#0b2545] dark:text-amber-400" />
              <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
                India Risk Map & Geospatial Intelligence · राष्ट्रीय मानचित्र
              </h1>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
              Dataset-derived project map across States & Union Territories
            </p>
          </div>
        </div>

        <IndiaRiskMap
          data={adminMapData ?? undefined}
          projects={adminProjects ?? undefined}
          height="h-[680px]"
          initialState={params.get("state") ?? "All"}
        />
      </div>
    );
  }

  // ---------------- OFFICER VIEW (State Risk Map - Section 2D) ----------------
  return (
    <div className="space-y-5 animate-fade-in pb-10">
      {/* Officer Header (Renamed to State Risk Map per Section 2D) */}
      <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800 rounded-md p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <MapPin size={18} className="text-[#0b2545] dark:text-amber-400" />
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
              State Risk Map · {assignedState}
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            District-level spatial surveillance and anomaly clusters exclusively within {assignedState}
          </p>
        </div>
        <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-navy-50 dark:bg-navy-800 text-navy-800 dark:text-amber-400 font-bold text-xs border border-navy-200 dark:border-navy-700">
          <MapPin size={12} /> Jurisdiction Locked: {assignedState}
        </span>
      </div>

      {/* Top Scoped KPIs */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <Card className="p-3 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800">
          <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
            <FolderKanban size={12} /> Total State Projects
          </span>
          <p className="text-xl font-black text-gray-900 dark:text-gray-100 mt-1">{stateProjects.length}</p>
        </Card>
        <Card className="p-3 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800">
          <span className="text-[10px] uppercase font-bold text-red-500 flex items-center gap-1">
            <ShieldAlert size={12} /> Critical/High Risk
          </span>
          <p className="text-xl font-black text-red-600 dark:text-red-400 mt-1">
            {stateProjects.filter((p) => p.riskScore >= 60).length}
          </p>
        </Card>
        <Card className="p-3 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800">
          <span className="text-[10px] uppercase font-bold text-gray-400 flex items-center gap-1">
            <Building2 size={12} /> Monitored Districts
          </span>
          <p className="text-xl font-black text-[#0b2545] dark:text-amber-400 mt-1">
            {districtBreakdown.length}
          </p>
        </Card>
        <Card className="p-3 bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800">
          <span className="text-[10px] uppercase font-bold text-emerald-600 flex items-center gap-1">
            <IndianRupee size={12} /> State Expenditure
          </span>
          <p className="text-xl font-black text-emerald-600 dark:text-emerald-400 mt-1">
            ₹{(stateProjects.reduce((s, p) => s + p.expenditure, 0) / 10000000).toFixed(2)} Cr
          </p>
        </Card>
      </div>

      {/* State Controls Toolbar */}
      <Card className="p-3.5 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800">
        <div className="grid grid-cols-1 sm:grid-cols-4 gap-2.5">
          {/* District filter (only assigned state districts) */}
          <Select
            label="District Filter"
            placeholder="All Districts"
            options={[
              { value: "All", label: "All Districts" },
              ...(DISTRICTS_BY_STATE[assignedState] || []).map((d) => ({ value: d, label: d })),
            ]}
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
          />

          {/* Work Category */}
          <Select
            label="Work Category"
            placeholder="All Categories"
            options={[{ value: "All", label: "All Categories" }, ...ALL_CATEGORIES.map((c) => ({ value: c, label: c }))]}
            value={selectedCategory}
            onChange={(e) => setSelectedCategory(e.target.value)}
          />

          {/* Risk Level */}
          <Select
            label="Risk Severity"
            placeholder="All Risk Levels"
            options={[
              { value: "All", label: "All Risk Levels" },
              { value: "Critical", label: "Critical" },
              { value: "High", label: "High" },
              { value: "Medium", label: "Medium" },
              { value: "Low", label: "Low" },
            ]}
            value={selectedRiskLevel}
            onChange={(e) => setSelectedRiskLevel(e.target.value)}
          />

          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              icon={<RotateCcw size={13} />}
              onClick={() => {
                setSelectedDistrict("All");
                setSelectedCategory("All");
                setSelectedRiskLevel("All");
                setSelectedProject(null);
              }}
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Main Focused State View: Map & District Breakdown Grid (Section 2D) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Focused Leaflet Map of Assigned State */}
        <div className="lg:col-span-2 rounded-md overflow-hidden border border-gray-200 dark:border-navy-800 bg-slate-100 dark:bg-navy-950 h-[520px] relative shadow-sm">
          <MapContainer
            center={stateCoords}
            zoom={7}
            minZoom={6}
            maxZoom={14}
            scrollWheelZoom={true}
            style={{ width: "100%", height: "100%" }}
          >
            <TileLayer
              attribution='&copy; <a href="https://www.esri.com/">Esri</a>'
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Street_Map/MapServer/tile/{z}/{y}/{x}"
            />

            {filteredStateProjects.map((p) => (
              <Marker
                key={p.id}
                position={[p.latitude, p.longitude]}
                icon={createMarkerIcon(p, selectedProject?.id === p.id)}
                eventHandlers={{
                  click: () => setSelectedProject(p),
                }}
              >
                <Tooltip direction="top" offset={[0, -18]} opacity={1}>
                  <div className="text-xs">
                    <p className="font-bold">{p.name}</p>
                    <p className="text-[10px] text-gray-500">{p.id} • {p.district}</p>
                  </div>
                </Tooltip>
                <Popup>
                  <div className="p-1 space-y-1.5 min-w-[200px]">
                    <p className="text-xs font-bold text-gray-900">{p.name}</p>
                    <p className="text-[10px] text-gray-500">{p.id} • {p.district}</p>
                    <div className="flex items-center justify-between pt-1 border-t border-gray-100">
                      <RiskBadge level={p.riskLevel} size="sm" />
                      <span className="text-xs font-bold text-navy-800">
                        ₹{(p.sanctionedAmount / 100000).toFixed(1)}L
                      </span>
                    </div>
                    <button
                      onClick={() => navigate(`${portalBase}/projects/${encodeURIComponent(p.id)}`)}
                      className="w-full mt-2 py-1 text-center bg-navy-700 hover:bg-navy-800 text-white rounded text-[11px] font-semibold"
                    >
                      Inspect Project Details →
                    </button>
                  </div>
                </Popup>
              </Marker>
            ))}
          </MapContainer>

          {/* Map Overlay Badge */}
          <div className="absolute bottom-3 left-3 bg-white/95 dark:bg-navy-900/95 backdrop-blur-sm p-2 rounded shadow border border-gray-200 dark:border-navy-700 text-xs z-[1000]">
            <p className="font-bold text-gray-900 dark:text-gray-100">
              {assignedState} Surveillance Zone
            </p>
            <p className="text-[10px] text-gray-500 dark:text-gray-400">
              Showing {filteredStateProjects.length} active sites
            </p>
          </div>
        </div>

        {/* District-level Breakdown Panel (Single focused view of assigned state) */}
        <Card noPadding className="lg:col-span-1 flex flex-col h-[520px] overflow-hidden border border-gray-200 dark:border-navy-800">
          <div className="p-3.5 bg-gray-50 dark:bg-navy-950 border-b border-gray-200 dark:border-navy-800 flex items-center justify-between">
            <div>
              <h2 className="font-bold text-xs text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                District-Level Breakdown
              </h2>
              <p className="text-[10px] text-gray-500 dark:text-gray-400">{assignedState} Jurisdictional Matrix</p>
            </div>
            <span className="text-[10px] font-semibold bg-navy-100 dark:bg-navy-800 text-navy-800 dark:text-amber-400 px-2 py-0.5 rounded">
              {districtBreakdown.length} Districts
            </span>
          </div>

          <div className="flex-1 overflow-y-auto divide-y divide-gray-100 dark:divide-navy-800 text-xs">
            {districtBreakdown.map((item) => (
              <div
                key={item.district}
                onClick={() => setSelectedDistrict(item.district === selectedDistrict ? "All" : item.district)}
                className={`p-3 cursor-pointer transition-colors ${
                  selectedDistrict === item.district
                    ? "bg-navy-50 dark:bg-navy-800/80 border-l-4 border-[#0b2545] dark:border-amber-400"
                    : "hover:bg-gray-50 dark:hover:bg-navy-800/40"
                }`}
              >
                <div className="flex items-center justify-between">
                  <span className="font-bold text-gray-900 dark:text-gray-100">{item.district}</span>
                  <div className="flex items-center gap-2">
                    {item.highRisk > 0 && (
                      <span className="text-[10px] font-semibold text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-950/60 px-1.5 py-0.5 rounded">
                        {item.highRisk} Critical
                      </span>
                    )}
                    <span className="text-[11px] text-gray-500 font-mono">{item.count} Works</span>
                  </div>
                </div>

                <div className="flex items-center justify-between text-[11px] text-gray-500 dark:text-gray-400 mt-2">
                  <span>Avg Risk: <strong className="text-gray-800 dark:text-gray-200">{item.avgScore}/100</strong></span>
                  <span>Fund Utilized: <strong className="text-emerald-700 dark:text-emerald-400">{item.utilization}%</strong></span>
                </div>
              </div>
            ))}
          </div>

          <div className="p-2.5 bg-gray-50 dark:bg-navy-950 border-t border-gray-100 dark:border-navy-800 text-[10px] text-gray-400 text-center">
            Click any district to filter map markers and anomaly breakdown
          </div>
        </Card>
      </div>
    </div>
  );
}
