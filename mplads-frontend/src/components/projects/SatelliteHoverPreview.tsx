import { useState } from "react";
import { Satellite, ExternalLink } from "lucide-react";
import type { Project } from "../../types";
import { getSatelliteImageUrl } from "../../services/api";

interface SatelliteHoverPreviewProps {
  project: Project;
  onNavigate?: () => void;
  showAlways?: boolean;
}

export default function SatelliteHoverPreview({
  project,
  onNavigate,
  showAlways = false,
}: SatelliteHoverPreviewProps) {
  const [isHovered, setIsHovered] = useState(false);

  const status = project.satelliteStatus || "no_imagery";
  const isGenuine = status === "visible";
  const isAbsent = status === "not_visible";

  // If not flagged as genuine or absent, and not showAlways, don't show an extra badge
  if (!isGenuine && !isAbsent && !showAlways) {
    return null;
  }

  const badgeConfig = isGenuine
    ? {
        label: "🛰️ Genuine: Structure Present",
        pillClass:
          "bg-emerald-50 hover:bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300 border-emerald-300 dark:border-emerald-700",
        tag: "✅ Structure Verified Present",
        tagClass: "text-emerald-400",
      }
    : isAbsent
    ? {
        label: "⚠️ Satellite: Structure Absent",
        pillClass:
          "bg-rose-50 hover:bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300 border-rose-300 dark:border-rose-700",
        tag: "⚠️ Anomaly: Structure Absent",
        tagClass: "text-rose-400",
      }
    : {
        label: "🛰️ Satellite Telemetry",
        pillClass:
          "bg-slate-50 hover:bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300 border-slate-300 dark:border-slate-600",
        tag: "🛰️ Optical Coverage Scan",
        tagClass: "text-amber-400",
      };

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Clickable Badge */}
      <button
        type="button"
        onClick={(e) => {
          e.stopPropagation();
          onNavigate?.();
        }}
        className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-semibold border transition-all cursor-pointer ${badgeConfig.pillClass}`}
        title="Hover for satellite preview · Click to open project dossier"
      >
        <span>{badgeConfig.label}</span>
      </button>

      {/* Floating Hover Popover */}
      {isHovered && (
        <div
          className="absolute z-[99] bottom-full left-0 mb-2 w-72 p-3 bg-slate-900 text-white rounded-xl shadow-2xl border border-slate-700/80 animate-in fade-in zoom-in-95 duration-150 pointer-events-none"
          style={{ filter: "drop-shadow(0 10px 15px rgba(0,0,0,0.5))" }}
        >
          {/* Header */}
          <div className="flex items-center justify-between gap-1.5 pb-2 border-b border-slate-800 mb-2">
            <div className="flex items-center gap-1.5 text-xs font-bold text-slate-200">
              <Satellite size={13} className="text-cyan-400" />
              <span>Satellite Verification Preview</span>
            </div>
            <span className="text-[10px] font-mono text-slate-400">
              {project.district}
            </span>
          </div>

          {/* High-Res Satellite Image Frame */}
          <div className="relative rounded-lg overflow-hidden bg-black border border-slate-700 mb-2">
            <img
              src={getSatelliteImageUrl(project.id)}
              alt="Satellite tile"
              className="w-full h-28 object-cover"
              loading="lazy"
            />
            <div className="absolute top-1.5 right-1.5 bg-black/80 backdrop-blur-xs text-[9px] font-mono text-slate-300 px-1.5 py-0.5 rounded border border-white/10">
              {project.satellitePassDate || "Sentinel-2"}
            </div>
          </div>

          {/* Status & Coordinates */}
          <div className="space-y-1">
            <div className={`text-[11px] font-bold ${badgeConfig.tagClass}`}>
              {badgeConfig.tag}
            </div>
            <div className="text-[10px] text-slate-400 font-mono flex items-center justify-between">
              <span>
                {Number(project.latitude).toFixed(4)}°N, {Number(project.longitude).toFixed(4)}°E
              </span>
              <span className="text-[9px] text-slate-500">10m Ground Res</span>
            </div>
          </div>

          {/* Instruction */}
          <div className="mt-2 pt-1.5 border-t border-slate-800 flex items-center justify-between text-[10px] text-cyan-300">
            <span>Click to inspect full dossier</span>
            <ExternalLink size={10} />
          </div>

          {/* Downward pointing triangle arrow */}
          <div className="absolute top-full left-4 -mt-1 w-2 h-2 bg-slate-900 border-r border-b border-slate-700 rotate-45 transform" />
        </div>
      )}
    </div>
  );
}
