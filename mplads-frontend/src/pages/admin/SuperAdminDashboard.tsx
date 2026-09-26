import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import {
  Users,
  ShieldAlert,
  MessageSquareWarning,
  Activity,
  Server,
  IndianRupee,
  FolderCheck,
  Filter,
} from "lucide-react";
import StatCard from "../../components/dashboard/StatCard";
import RiskDistributionChart from "../../components/dashboard/RiskDistributionChart";
import IndiaRiskMap from "../../components/dashboard/IndiaRiskMap";
import PriorityAlerts from "../../components/dashboard/PriorityAlerts";
import { CardSkeleton } from "../../components/ui/Feedback";
import Card from "../../components/ui/Card";
import { getSystemOverview, getRiskMapData, getRiskAlerts, getOfficers, getAuditLogs, getProjects } from "../../services/api";
import { DISTRICTS_BY_STATE } from "../../data/geography";
import type { Project } from "../../types";
import { formatDate } from "../../lib/format";
import GovPageHeader from "../../components/layout/GovPageHeader";

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getSystemOverview>> | null>(null);
  const [mapData, setMapData] = useState<any[] | null>(null);
  const [alerts, setAlerts] = useState<any[] | null>(null);
  const [officers, setOfficers] = useState<any[] | null>(null);
  const [logs, setLogs] = useState<any[] | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);

  // Filters: State defaults to "All India"
  const [selectedState, setSelectedState] = useState("All India");
  const [selectedDistrict, setSelectedDistrict] = useState("All Districts");

  useEffect(() => {
    getRiskMapData().then(setMapData);
    getRiskAlerts({ status: "Open" }).then((a) => setAlerts(a));
    getOfficers().then(setOfficers);
    getAuditLogs(6).then(setLogs);
    getProjects({ pageSize: 300 }).then((result) => setProjects(result.data));
  }, []);

  useEffect(() => {
    getSystemOverview(selectedState, selectedDistrict).then(setOverview);
  }, [selectedState, selectedDistrict]);

  const stateList = useMemo(() => ["All India", ...Object.keys(DISTRICTS_BY_STATE).sort()], []);

  const districtList = useMemo(() => {
    if (selectedState === "All India") return ["All Districts"];
    return ["All Districts", ...(DISTRICTS_BY_STATE[selectedState] || [])];
  }, [selectedState]);

  // Compute live aggregates for KPIs
  const totalExpenditure = Number(overview?.totalDisbursed || 0);

  const totalSanctionedProjects = overview?.totalProjects || 0;

  const formattedExpenditure = totalExpenditure >= 10000000
    ? `₹${(totalExpenditure / 10000000).toFixed(2)} Cr`
    : `₹${(totalExpenditure / 100000).toFixed(2)} L`;

  // Reactive Risk Distribution Chart Data
  const reactiveRiskDist = [
    { name: "Low", value: overview?.riskDistribution?.low || 0, color: "#16a34a" },
    { name: "Medium", value: overview?.riskDistribution?.medium || 0, color: "#d97706" },
    { name: "High", value: overview?.riskDistribution?.high || 0, color: "#ea580c" },
    { name: "Critical", value: overview?.riskDistribution?.critical || 0, color: "#dc2626" },
  ];

  // Reactive Officers List
  const reactiveOfficers = useMemo(() => {
    if (!officers) return [];
    if (selectedState === "All India") return officers;
    return officers.filter((o) => o.state.toLowerCase() === selectedState.toLowerCase());
  }, [officers, selectedState]);

  // Reactive Priority Alerts
  const reactiveAlerts = useMemo(() => {
    if (!alerts) return [];
    if (selectedState === "All India") return alerts.slice(0, 5);
    return alerts
      .filter((a) => {
        return a.location.toLowerCase().includes(selectedState.toLowerCase());
      })
      .slice(0, 5);
  }, [alerts, selectedState]);

  const activeAlertCount = !alerts ? 0 : selectedState === "All India"
    ? alerts.length
    : alerts.filter((alert) => alert.location.toLowerCase().includes(selectedState.toLowerCase())).length;

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Dashboard Top Banner — Official GovPageHeader */}
      <GovPageHeader
        title="National Monitoring Overview · राष्ट्रीय निगरानी"
        description="Dataset-derived analytics across States & Union Territories · MoSPI Central Control"
        statusDot="green"
        rightContent={
          <div className="flex items-center flex-wrap gap-2.5 bg-gray-50 p-2 rounded border border-gray-200">
            <div className="flex items-center gap-1.5 text-xs text-gray-700 font-semibold px-1">
              <Filter size={14} className="text-[#0b2545]" />
              <span>State:</span>
            </div>
            <select
              value={selectedState}
              onChange={(e) => { setSelectedState(e.target.value); setSelectedDistrict("All Districts"); }}
              className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-900 outline-none focus:border-[#0b2545]"
            >
              {stateList.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
            {selectedState !== "All India" && (
              <select
                value={selectedDistrict}
                onChange={(e) => setSelectedDistrict(e.target.value)}
                className="rounded border border-gray-300 bg-white px-2.5 py-1.5 text-xs font-medium text-gray-900 outline-none focus:border-[#0b2545]"
              >
                {districtList.map((d) => <option key={d} value={d}>{d}</option>)}
              </select>
            )}
            <div className="text-[10px] text-gray-400 pl-2 hidden sm:flex items-center gap-1">
              <Server size={11} /> Backend: {overview?.systemUptime ?? "Checking"}
            </div>
          </div>
        }
      />

      {/* KPI Cards Row (Includes the 2 new requested cards: Total State Expenditure & Total Sanctioned Projects) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {!overview ? (
          Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            {/* NEW KPI CARD 1: Total State Expenditure */}
            <StatCard
              label={selectedState === "All India" ? "Total Expenditure" : "State Expenditure"}
              value={formattedExpenditure}
              icon={IndianRupee}
              tone="green"
            />

            {/* NEW KPI CARD 2: Total Sanctioned Projects */}
            <StatCard
              label={selectedState === "All India" ? "Sanctioned Projects" : "State Projects"}
              value={totalSanctionedProjects.toLocaleString("en-IN")}
              icon={FolderCheck}
              tone="navy"
              onClick={() => navigate("/admin/projects")}
            />

            {/* Existing KPIs reactive to filter */}
            <StatCard
              label="Assigned Officers"
              value={String(reactiveOfficers.length)}
              icon={Users}
              tone="navy"
              onClick={() => navigate("/admin/officers")}
            />

            <StatCard
              label="Active In Roster"
              value={String(reactiveOfficers.filter((o) => o.status === "Active").length)}
              icon={Activity}
              tone="green"
            />

            <StatCard
              label="Active Alerts"
              value={String(activeAlertCount)}
              icon={ShieldAlert}
              tone="amber"
              onClick={() => navigate("/admin/alerts")}
            />

            <StatCard
              label="Pending Reports"
              value={String(overview.pendingCitizenReports)}
              icon={MessageSquareWarning}
              tone="red"
              onClick={() => navigate("/admin/citizen-reports")}
            />
          </>
        )}
      </div>

      {/* Charts & Officer Summary Section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <RiskDistributionChart data={reactiveRiskDist} />

        <Card className="lg:col-span-2" noPadding>
          <div className="p-4 pb-3 flex items-center justify-between border-b border-gray-100 dark:border-navy-800">
            <div>
              <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                Officer Roster Summary · अधिकारी दल
              </h3>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Monitoring officers {selectedState !== "All India" ? `in ${selectedState}` : "across all jurisdictions"}
              </p>
            </div>
            <button
              onClick={() => navigate("/admin/officers")}
              className="text-xs font-semibold text-[#0b2545] dark:text-amber-400 hover:underline"
            >
              Manage Officers →
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead>
                <tr className="text-left text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-navy-950 border-b border-gray-100 dark:border-navy-800">
                  <th className="py-2.5 px-4 font-semibold">Officer Name</th>
                  <th className="py-2.5 px-3 font-semibold">State / Jurisdiction</th>
                  <th className="py-2.5 px-3 font-semibold">Assigned Projects</th>
                  <th className="py-2.5 px-3 font-semibold">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
                {reactiveOfficers.slice(0, 5).map((o) => (
                  <tr key={o.id} className="hover:bg-gray-50 dark:hover:bg-navy-800/40 transition-colors">
                    <td className="py-2.5 px-4 font-medium text-gray-900 dark:text-gray-100">{o.name}</td>
                    <td className="py-2.5 px-3 text-gray-600 dark:text-gray-300">{o.jurisdiction}</td>
                    <td className="py-2.5 px-3 text-gray-700 dark:text-gray-300 font-medium">{o.projectsAssigned}</td>
                    <td className="py-2.5 px-3">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${o.status === "Active" ? "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300" : "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"}`}>
                        {o.status === "Active" ? "● Active" : "○ Inactive"}
                      </span>
                    </td>
                  </tr>
                ))}
                {reactiveOfficers.length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-6 text-center text-gray-400">
                      No officers registered for {selectedState}.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {/* Real National Risk Map */}
      {mapData && <IndiaRiskMap data={mapData} projects={projects} />}

      {/* Priority Alerts & Recent Activity */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2">
          <PriorityAlerts alerts={reactiveAlerts} />
        </div>
        <Card>
          <div className="pb-3 border-b border-gray-100 dark:border-navy-800 mb-3">
            <h3 className="font-bold text-sm text-gray-900 dark:text-gray-100 uppercase tracking-wide">
              Recent Activity · ऑडिट लॉग
            </h3>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">System-wide operational actions</p>
          </div>
          <div className="space-y-3">
            {(logs ?? []).map((l) => (
              <div
                key={l.id}
                className="flex items-start gap-2.5 pb-2.5 border-b border-gray-100 dark:border-navy-800 last:border-0 last:pb-0"
              >
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-[#138808] shrink-0" />
                <div className="min-w-0">
                  <p className="text-xs text-gray-800 dark:text-gray-200">
                    <span className="font-semibold text-gray-900 dark:text-gray-100">{l.actor}</span> · {l.action}
                  </p>
                  <p className="text-[10px] text-gray-400 mt-0.5">
                    {l.target} · {formatDate(l.timestamp)}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
