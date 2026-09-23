import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { usePortalBase } from "../../lib/usePortalBase";
import { MapPin, ChevronRight } from "lucide-react";
import clsx from "clsx";
import Card from "../ui/Card";
import type { StateRiskData } from "../../types";
import { riskLevelColor } from "../../lib/format";

const RISK_BG: Record<string, string> = {
  Low: "bg-green-100 hover:bg-green-200 border-green-300",
  Medium: "bg-amber-100 hover:bg-amber-200 border-amber-300",
  High: "bg-orange-100 hover:bg-orange-200 border-orange-300",
  Critical: "bg-red-100 hover:bg-red-200 border-red-300",
};

export default function IndiaRiskMap({ data, compact }: { data: StateRiskData[]; compact?: boolean }) {
  const [hovered, setHovered] = useState<StateRiskData | null>(null);
  const navigate = useNavigate();
  const portalBase = usePortalBase();

  return (
    <Card noPadding className="overflow-hidden">
      <div className="p-5 pb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">India Risk Map</h3>
          <p className="text-xs text-gray-500 mt-0.5">State-level risk concentration</p>
        </div>
        <div className="flex items-center gap-3 text-[11px] text-gray-500">
          {["Low", "Medium", "High", "Critical"].map((l) => (
            <span key={l} className="flex items-center gap-1">
              <span className="w-2.5 h-2.5 rounded-full" style={{ background: riskLevelColor(l) }} />
              {l}
            </span>
          ))}
        </div>
      </div>

      <div className="px-5 pb-5">
        <div className={clsx("grid gap-2.5", compact ? "grid-cols-2 sm:grid-cols-3" : "grid-cols-2 sm:grid-cols-3 md:grid-cols-5")}>
          {data.map((s) => (
            <button
              key={s.state}
              onMouseEnter={() => setHovered(s)}
              onMouseLeave={() => setHovered(null)}
              onClick={() => navigate(`${portalBase}/risk-map?state=${encodeURIComponent(s.state)}`)}
              className={clsx(
                "relative border rounded-lg p-3 text-left transition-colors",
                RISK_BG[s.riskLevel]
              )}
            >
              <div className="flex items-center gap-1 text-gray-700 mb-1">
                <MapPin size={12} />
                <span className="text-xs font-semibold truncate">{s.state}</span>
              </div>
              <p className="text-lg font-bold text-gray-900">{s.totalProjects.toLocaleString("en-IN")}</p>
              <p className="text-[10px] text-gray-500">projects</p>
            </button>
          ))}
        </div>

        {hovered && (
          <div className="mt-4 bg-navy-900 text-white rounded-lg p-4 animate-fade-in">
            <div className="flex items-center justify-between mb-2">
              <p className="font-semibold">{hovered.state}</p>
              <button
                onClick={() => navigate(`${portalBase}/risk-map?state=${encodeURIComponent(hovered.state)}`)}
                className="text-xs flex items-center gap-0.5 text-navy-200 hover:text-white"
              >
                View details <ChevronRight size={12} />
              </button>
            </div>
            <div className="grid grid-cols-4 gap-3 text-xs">
              <div>
                <p className="text-navy-300">Projects</p>
                <p className="font-semibold text-white">{hovered.totalProjects.toLocaleString("en-IN")}</p>
              </div>
              <div>
                <p className="text-navy-300">High Risk</p>
                <p className="font-semibold text-white">{hovered.highRisk}</p>
              </div>
              <div>
                <p className="text-navy-300">Alerts</p>
                <p className="font-semibold text-white">{hovered.alerts}</p>
              </div>
              <div>
                <p className="text-navy-300">Utilization</p>
                <p className="font-semibold text-white">{hovered.fundUtilization}%</p>
              </div>
            </div>
          </div>
        )}
      </div>
    </Card>
  );
}
