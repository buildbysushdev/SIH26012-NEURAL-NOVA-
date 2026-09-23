import { useEffect, useState } from "react";
import { Search as SearchIcon } from "lucide-react";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import { RiskBadge, StatusBadge } from "../components/ui/Badge";
import { EmptyState, Skeleton } from "../components/ui/Feedback";
import { getRiskAlerts } from "../services/api";
import { formatDate } from "../lib/format";
import type { RiskAlert } from "../types";
import AlertDetails from "../components/alerts/AlertDetails";
import clsx from "clsx";

const TABS = ["All", "Critical", "High", "Medium", "Resolved"];

export default function Alerts() {
  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [alerts, setAlerts] = useState<RiskAlert[] | null>(null);
  const [selected, setSelected] = useState<RiskAlert | null>(null);

  useEffect(() => {
    setAlerts(null);
    const filters =
      tab === "Resolved"
        ? { status: "Resolved", search }
        : tab === "All"
        ? { search }
        : { riskLevel: tab, search };
    getRiskAlerts(filters).then(setAlerts);
  }, [tab, search]);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900">Risk & Alerts</h2>
        <div className="w-full sm:w-72">
          <Input
            placeholder="Search alert ID, project..."
            icon={<SearchIcon size={16} />}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
      </div>

      <div className="flex gap-1 bg-gray-100 rounded-lg p-1 w-fit overflow-x-auto max-w-full">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "text-sm font-medium px-3.5 py-1.5 rounded-md whitespace-nowrap transition-colors",
              tab === t ? "bg-white shadow-sm text-navy-800" : "text-gray-500"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      <Card noPadding className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[860px]">
            <thead>
              <tr className="text-left text-gray-400 text-xs border-b border-gray-100 bg-gray-50/50">
                <th className="py-3 px-4 font-medium">Alert ID</th>
                <th className="py-3 px-3 font-medium">Project ID</th>
                <th className="py-3 px-3 font-medium">Risk Score</th>
                <th className="py-3 px-3 font-medium">Alert Type</th>
                <th className="py-3 px-3 font-medium">Description</th>
                <th className="py-3 px-3 font-medium">Detected</th>
                <th className="py-3 px-3 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {!alerts &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td colSpan={8} className="py-3 px-4">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))}
              {alerts?.map((a) => (
                <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 last:border-0">
                  <td className="py-3 px-4 font-medium text-navy-800 whitespace-nowrap">{a.id}</td>
                  <td className="py-3 px-3 text-gray-600 whitespace-nowrap">{a.projectId}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-800">{a.riskScore}</span>
                      <RiskBadge level={a.riskLevel} size="sm" />
                    </div>
                  </td>
                  <td className="py-3 px-3 text-gray-600 whitespace-nowrap">{a.type}</td>
                  <td className="py-3 px-3 text-gray-500 max-w-[240px] truncate">{a.description}</td>
                  <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{formatDate(a.detectedDate)}</td>
                  <td className="py-3 px-3"><StatusBadge status={a.status} /></td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => setSelected(a)} className="text-xs font-medium text-navy-700 hover:underline">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {alerts && alerts.length === 0 && (
          <EmptyState title="No alerts found" description="Try a different filter or search term." />
        )}
      </Card>

      <AlertDetails
        alert={selected}
        onClose={() => setSelected(null)}
        onUpdated={(updated) => {
          setAlerts((prev) => prev?.map((a) => (a.id === updated.id ? updated : a)) ?? null);
          setSelected(updated);
        }}
      />
    </div>
  );
}
