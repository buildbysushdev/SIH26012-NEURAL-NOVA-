import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePortalBase } from "../lib/usePortalBase";
import { MapPin, ArrowRight } from "lucide-react";
import Card from "../components/ui/Card";
import Select from "../components/ui/Select";
import Button from "../components/ui/Button";
import { Skeleton } from "../components/ui/Feedback";
import { getRiskMapData } from "../services/api";
import { ALL_CATEGORIES } from "../data/mockData";
import { riskLevelColor } from "../lib/format";
import type { StateRiskData } from "../types";
import clsx from "clsx";

const RISK_BG: Record<string, string> = {
  Low: "bg-green-100 hover:bg-green-200 border-green-300",
  Medium: "bg-amber-100 hover:bg-amber-200 border-amber-300",
  High: "bg-orange-100 hover:bg-orange-200 border-orange-300",
  Critical: "bg-red-100 hover:bg-red-200 border-red-300",
};

export default function RiskMap() {
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const portalBase = usePortalBase();
  const [data, setData] = useState<StateRiskData[] | null>(null);
  const [riskFilter, setRiskFilter] = useState("");
  const [category, setCategory] = useState("");
  const [selected, setSelected] = useState<StateRiskData | null>(null);

  useEffect(() => {
    getRiskMapData().then((d) => {
      setData(d);
      const initial = params.get("state");
      if (initial) setSelected(d.find((s) => s.state === initial) ?? null);
    });
  }, []);

  const filtered = data?.filter((s) => !riskFilter || s.riskLevel === riskFilter);

  return (
    <div className="space-y-5 animate-fade-in">
      <h2 className="text-xl font-bold text-gray-900">India Risk Map</h2>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <Select
            placeholder="All Risk Levels"
            options={["Low", "Medium", "High", "Critical"].map((r) => ({ value: r, label: r }))}
            value={riskFilter}
            onChange={(e) => setRiskFilter(e.target.value)}
          />
          <Select
            placeholder="All Categories"
            options={ALL_CATEGORIES.map((c) => ({ value: c, label: c }))}
            value={category}
            onChange={(e) => setCategory(e.target.value)}
          />
          <Select placeholder="All Years" options={[{ value: "2024", label: "2024" }, { value: "2025", label: "2025" }, { value: "2026", label: "2026" }]} />
        </div>
      </Card>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <Card className="lg:col-span-2">
          <div className="flex items-center gap-4 mb-4 text-[11px] text-gray-500">
            {["Low", "Medium", "High", "Critical"].map((l) => (
              <span key={l} className="flex items-center gap-1">
                <span className="w-2.5 h-2.5 rounded-full" style={{ background: riskLevelColor(l) }} /> {l}
              </span>
            ))}
          </div>
          {!filtered ? (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {Array.from({ length: 9 }).map((_, i) => (
                <Skeleton key={i} className="h-24 w-full" />
              ))}
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filtered.map((s) => (
                <button
                  key={s.state}
                  onClick={() => {
                    setSelected(s);
                    setParams({ state: s.state });
                  }}
                  className={clsx(
                    "border rounded-lg p-4 text-left transition-colors",
                    RISK_BG[s.riskLevel],
                    selected?.state === s.state && "ring-2 ring-navy-700"
                  )}
                >
                  <div className="flex items-center gap-1 text-gray-700 mb-1.5">
                    <MapPin size={13} />
                    <span className="text-sm font-semibold">{s.state}</span>
                  </div>
                  <p className="text-xl font-bold text-gray-900">{s.totalProjects.toLocaleString("en-IN")}</p>
                  <p className="text-[11px] text-gray-500">total projects</p>
                  <div className="flex items-center gap-2 mt-2 text-[11px] text-gray-600">
                    <span>{s.highRisk} high risk</span>
                    <span>·</span>
                    <span>{s.critical} critical</span>
                  </div>
                </button>
              ))}
            </div>
          )}
        </Card>

        <Card>
          {selected ? (
            <div className="animate-fade-in">
              <h3 className="font-bold text-lg text-gray-900">{selected.state}</h3>
              <p className="text-xs text-gray-400 mb-4">State-level risk summary</p>
              <div className="space-y-3">
                {[
                  ["Total Projects", selected.totalProjects.toLocaleString("en-IN")],
                  ["High Risk", String(selected.highRisk)],
                  ["Critical", String(selected.critical)],
                  ["Alerts", String(selected.alerts)],
                  ["Fund Utilization", `${selected.fundUtilization}%`],
                ].map(([label, value]) => (
                  <div key={label} className="flex justify-between items-center border-b border-gray-50 pb-2.5 last:border-0">
                    <span className="text-sm text-gray-500">{label}</span>
                    <span className="text-sm font-semibold text-gray-800">{value}</span>
                  </div>
                ))}
              </div>
              <Button
                className="w-full mt-5"
                icon={<ArrowRight size={14} />}
                onClick={() => navigate(`${portalBase}/projects?state=${encodeURIComponent(selected.state)}`)}
              >
                View Projects
              </Button>
            </div>
          ) : (
            <div className="text-center py-10 text-sm text-gray-400">Select a state to view details.</div>
          )}
        </Card>
      </div>
    </div>
  );
}
