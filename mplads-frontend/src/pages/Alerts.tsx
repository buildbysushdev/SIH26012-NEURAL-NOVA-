import { useEffect, useState, useMemo } from "react";
import { Search as SearchIcon, ShieldAlert } from "lucide-react";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import { RiskBadge, StatusBadge } from "../components/ui/Badge";
import { EmptyState, Skeleton } from "../components/ui/Feedback";
import { getRiskAlerts } from "../services/api";
import { formatDate } from "../lib/format";
import type { RiskAlert } from "../types";
import AlertDetails from "../components/alerts/AlertDetails";
import { useAuth } from "../context/AuthContext";
import { usePortalBase } from "../lib/usePortalBase";
import { DISTRICTS_BY_STATE, PROJECTS } from "../data/mockData";
import clsx from "clsx";

const TABS = ["All", "Critical", "High", "Medium", "Resolved"];

export default function Alerts() {
  const portalBase = usePortalBase();
  const { user } = useAuth();
  const isOfficer = user?.role === "officer" || !portalBase.includes("admin");
  const officerAssignedState = isOfficer ? (user?.assignedState || user?.jurisdiction || "Maharashtra") : "";

  const [tab, setTab] = useState("All");
  const [search, setSearch] = useState("");
  const [selectedState, setSelectedState] = useState(isOfficer ? officerAssignedState : "");
  const [selectedDistrict, setSelectedDistrict] = useState("");
  const [alerts, setAlerts] = useState<RiskAlert[] | null>(null);
  const [selected, setSelected] = useState<RiskAlert | null>(null);

  const effectiveState = isOfficer ? officerAssignedState : selectedState;

  const districtOptions = useMemo(() => {
    if (!effectiveState) return [];
    return DISTRICTS_BY_STATE[effectiveState] ?? [];
  }, [effectiveState]);

  useEffect(() => {
    if (isOfficer) {
      setSelectedState(officerAssignedState);
    }
  }, [isOfficer, officerAssignedState]);

  useEffect(() => {
    setAlerts(null);
    const filters: {
      status?: string;
      riskLevel?: string;
      search?: string;
      state?: string;
      district?: string;
    } = {
      search: search || undefined,
      state: effectiveState || undefined,
      district: selectedDistrict || undefined,
    };

    if (tab === "Resolved") {
      filters.status = "Resolved";
    } else if (tab !== "All") {
      filters.riskLevel = tab;
    }

    getRiskAlerts(filters).then(setAlerts);
  }, [tab, search, effectiveState, selectedDistrict]);

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Header */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <div className="flex items-center gap-2">
            <ShieldAlert size={20} className="text-gov-navy dark:text-saffron-400" />
            <h2 className="text-xl font-bold text-gray-900 dark:text-white">
              {isOfficer ? `Risk Alerts — ${officerAssignedState}` : "National Risk & Anomaly Alerts"}
            </h2>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {isOfficer
              ? `Real-time algorithmic risk detection and anomalies scoped to ${officerAssignedState}`
              : "Cross-jurisdiction risk detection, financial outliers, and physical milestone delays"}
          </p>
        </div>
      </div>

      {/* Filter Bar */}
      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Input
              placeholder="Search alert ID, project ID, keywords..."
              icon={<SearchIcon size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          {/* State Filter / Label */}
          {isOfficer ? (
            <div className="flex items-center px-3 py-2 bg-gov-blue/10 dark:bg-navy-900 border border-gov-blue/30 dark:border-navy-700 rounded-md text-xs">
              <span className="text-gray-500 dark:text-gray-400 mr-2 font-medium">Assigned State:</span>
              <span className="font-bold text-gov-blue dark:text-saffron-400">{officerAssignedState}</span>
            </div>
          ) : (
            <Select
              placeholder="All States"
              options={[
                { value: "", label: "All India" },
                ...Object.keys(DISTRICTS_BY_STATE).map((s) => ({ value: s, label: s })),
              ]}
              value={selectedState}
              onChange={(e) => {
                setSelectedState(e.target.value);
                setSelectedDistrict("");
              }}
            />
          )}

          {/* District Filter */}
          <Select
            placeholder="All Districts"
            options={[
              { value: "", label: "All Districts" },
              ...districtOptions.map((d) => ({ value: d, label: d })),
            ]}
            value={selectedDistrict}
            onChange={(e) => setSelectedDistrict(e.target.value)}
            disabled={!isOfficer && !selectedState}
          />
        </div>
      </Card>

      {/* Severity Tabs */}
      <div className="flex gap-1 bg-gray-100 dark:bg-navy-900/80 border border-gray-200 dark:border-navy-800 rounded-lg p-1 w-fit overflow-x-auto max-w-full">
        {TABS.map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={clsx(
              "text-xs font-semibold px-3.5 py-1.5 rounded-md whitespace-nowrap transition-colors",
              tab === t
                ? "bg-gov-navy text-white dark:bg-saffron-500 dark:text-navy-950 shadow-sm"
                : "text-gray-600 dark:text-gray-400 hover:text-gray-900 dark:hover:text-white"
            )}
          >
            {t}
          </button>
        ))}
      </div>

      {/* Alerts Table */}
      <Card noPadding className="overflow-hidden border border-gray-200 dark:border-navy-700">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left text-gray-600 dark:text-gray-300 text-xs border-b border-gray-200 dark:border-navy-700 bg-gray-50/80 dark:bg-navy-900">
                <th className="py-3 px-4 font-semibold">Alert ID</th>
                <th className="py-3 px-3 font-semibold">Project</th>
                <th className="py-3 px-3 font-semibold">Location</th>
                <th className="py-3 px-3 font-semibold">Risk Score</th>
                <th className="py-3 px-3 font-semibold">Alert Type</th>
                <th className="py-3 px-3 font-semibold">Description</th>
                <th className="py-3 px-3 font-semibold">Detected</th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
              {!alerts &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-navy-800">
                    <td colSpan={9} className="py-3 px-4">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))}
              {alerts?.map((a) => {
                const proj = PROJECTS.find((p) => p.id === a.projectId);
                const locationDisplay = proj ? `${proj.district}, ${proj.state}` : a.location;
                return (
                  <tr
                    key={a.id}
                    className="border-b border-gray-100 dark:border-navy-800 hover:bg-gray-50/80 dark:hover:bg-navy-800/60 transition-colors last:border-0"
                  >
                    <td className="py-3 px-4 font-semibold text-navy-800 dark:text-saffron-400 whitespace-nowrap">
                      {a.id}
                    </td>
                    <td className="py-3 px-3 whitespace-nowrap">
                      <div className="font-medium text-gray-800 dark:text-gray-200">{a.projectId}</div>
                      <div className="text-[11px] text-gray-500 dark:text-gray-400 max-w-[160px] truncate">
                        {a.projectName}
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-600 dark:text-gray-300 text-xs whitespace-nowrap">
                      {locationDisplay}
                    </td>
                    <td className="py-3 px-3">
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold text-gray-800 dark:text-gray-200">{a.riskScore}</span>
                        <RiskBadge level={a.riskLevel} size="sm" />
                      </div>
                    </td>
                    <td className="py-3 px-3 text-gray-700 dark:text-gray-300 whitespace-nowrap font-medium text-xs">
                      {a.type}
                    </td>
                    <td className="py-3 px-3 text-gray-600 dark:text-gray-300 max-w-[220px] truncate text-xs">
                      {a.description}
                    </td>
                    <td className="py-3 px-3 text-gray-500 dark:text-gray-400 whitespace-nowrap text-xs">
                      {formatDate(a.detectedDate)}
                    </td>
                    <td className="py-3 px-3">
                      <StatusBadge status={a.status} />
                    </td>
                    <td className="py-3 px-4 text-right">
                      <button
                        onClick={() => setSelected(a)}
                        className="text-xs font-semibold text-gov-blue dark:text-saffron-400 hover:underline"
                      >
                        Inspect
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {alerts && alerts.length === 0 && (
          <EmptyState
            title="No risk alerts found"
            description={
              isOfficer
                ? `No alerts detected for ${officerAssignedState} under current filters.`
                : "No matching alerts found across monitored jurisdictions."
            }
          />
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
