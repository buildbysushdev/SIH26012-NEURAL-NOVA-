import { useMemo } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { ExternalLink, MapPin } from "lucide-react";

// Default coordinates for Indian states / fallback
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
  Delhi: [28.6139, 77.209],
  Jharkhand: [23.6102, 85.2799],
  Kerala: [10.8505, 76.2711],
  Odisha: [20.9517, 85.0985],
  Haryana: [29.0588, 76.0856],
  Telangana: [18.1124, 79.0193],
};

// Custom SVG Location Pin
const createOsmPin = () =>
  L.divIcon({
    className: "custom-osm-pin",
    html: `
      <div style="position:relative; width:30px; height:36px; display:flex; align-items:center; justify-content:center;">
        <svg viewBox="0 0 24 24" width="30" height="36" fill="#dc2626" style="filter: drop-shadow(0 2px 4px rgba(0,0,0,0.4));">
          <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
        </svg>
      </div>
    `,
    iconSize: [30, 36],
    iconAnchor: [15, 36],
    popupAnchor: [0, -32],
  });

interface LocationOsmMapProps {
  latitude?: number | null;
  longitude?: number | null;
  locationName?: string;
  projectName?: string;
  projectId?: string;
  height?: string;
  zoom?: number;
  className?: string;
}

export default function LocationOsmMap({
  latitude,
  longitude,
  locationName = "Project Site",
  projectName,
  projectId,
  height = "200px",
  zoom = 13,
  className = "",
}: LocationOsmMapProps) {
  const pinIcon = useMemo(() => createOsmPin(), []);

  // Determine effective coordinates: given lat/lng or fallback based on locationName
  const coords: [number, number] = useMemo(() => {
    if (
      latitude &&
      longitude &&
      Number.isFinite(latitude) &&
      Number.isFinite(longitude) &&
      !(Math.abs(latitude - 20.5937) < 0.001 && Math.abs(longitude - 78.9629) < 0.001) &&
      (latitude !== 0 || longitude !== 0)
    ) {
      return [latitude, longitude];
    }

    // Try state centroid match from locationName
    if (locationName) {
      for (const [st, c] of Object.entries(STATE_COORDINATES)) {
        if (locationName.toLowerCase().includes(st.toLowerCase())) {
          return c;
        }
      }
    }

    // Default to Pune / Maharashtra center
    return [18.5204, 73.8567];
  }, [latitude, longitude, locationName]);

  const osmUrl = `https://www.openstreetmap.org/?mlat=${coords[0].toFixed(4)}&mlon=${coords[1].toFixed(4)}#map=${zoom}/${coords[0].toFixed(4)}/${coords[1].toFixed(4)}`;

  return (
    <div className={`relative rounded-lg overflow-hidden border border-gray-200 dark:border-navy-700 shadow-xs bg-slate-100 ${className}`}>
      {/* Top Coordinate Header Bar */}
      <div className="bg-slate-900/90 text-white text-[11px] px-3 py-1.5 flex items-center justify-between border-b border-slate-800">
        <div className="flex items-center gap-1.5 min-w-0 font-medium">
          <MapPin size={13} className="text-amber-400 shrink-0" />
          <span className="truncate">{locationName}</span>
        </div>
        <a
          href={osmUrl}
          target="_blank"
          rel="noreferrer"
          className="inline-flex items-center gap-1 text-[10px] text-amber-300 hover:text-white underline shrink-0 ml-2"
          title="Open in full OpenStreetMap"
        >
          OSM <ExternalLink size={10} />
        </a>
      </div>

      {/* Live Leaflet OpenStreetMap Container */}
      <div style={{ height }}>
        <MapContainer
          center={coords}
          zoom={zoom}
          scrollWheelZoom={false}
          style={{ height: "100%", width: "100%", zIndex: 1 }}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <Marker position={coords} icon={pinIcon}>
            <Popup>
              <div className="text-xs space-y-1 p-0.5">
                {projectId && <div className="font-mono font-bold text-navy-900">{projectId}</div>}
                {projectName && <div className="font-semibold text-gray-800 text-[11px]">{projectName}</div>}
                <div className="text-gray-500 text-[10px]">{locationName}</div>
                <div className="text-blue-700 font-mono text-[10px]">
                  {coords[0].toFixed(4)}°N, {coords[1].toFixed(4)}°E
                </div>
              </div>
            </Popup>
          </Marker>
        </MapContainer>
      </div>

      {/* Coordinate Chip */}
      <div className="absolute bottom-2 left-2 z-[400] bg-white/95 dark:bg-navy-950/90 backdrop-blur-xs px-2 py-0.5 rounded text-[10px] font-mono text-gray-700 dark:text-gray-200 border border-gray-200 dark:border-navy-800 shadow-xs pointer-events-none">
        {coords[0].toFixed(4)}°N, {coords[1].toFixed(4)}°E
      </div>
    </div>
  );
}
