import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Users, FolderKanban, ShieldAlert, MessageSquareWarning, Activity, Server } from "lucide-react";
import StatCard from "../../components/dashboard/StatCard";
import RiskDistributionChart from "../../components/dashboard/RiskDistributionChart";
import IndiaRiskMap from "../../components/dashboard/IndiaRiskMap";
import PriorityAlerts from "../../components/dashboard/PriorityAlerts";
import { CardSkeleton } from "../../components/ui/Feedback";
import Card from "../../components/ui/Card";
import { StatusBadge } from "../../components/ui/Badge";
import {
  getSystemOverview,
  getRiskDistribution,
  getRiskMapData,
  getRiskAlerts,
  getOfficers,
  getAuditLogs,
} from "../../services/api";
import { formatDate } from "../../lib/format";

export default function SuperAdminDashboard() {
  const navigate = useNavigate();
  const [overview, setOverview] = useState<Awaited<ReturnType<typeof getSystemOverview>> | null>(null);
  const [riskDist, setRiskDist] = useState<any[] | null>(null);
  const [mapData, setMapData] = useState<any[] | null>(null);
  const [alerts, setAlerts] = useState<any[] | null>(null);
  const [officers, setOfficers] = useState<any[] | null>(null);
  const [logs, setLogs] = useState<any[] | null>(null);

  useEffect(() => {
    getSystemOverview().then(setOverview);
    getRiskDistribution().then(setRiskDist);
    getRiskMapData().then(setMapData);
    getRiskAlerts({ status: "Open" }).then((a) => setAlerts(a.slice(0, 5)));
    getOfficers().then(setOfficers);
    getAuditLogs(6).then(setLogs);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">System Overview</h2>
          <p className="text-sm text-gray-500 mt-0.5">All India · All Officers</p>
        </div>
        <p className="text-xs text-gray-400 flex items-center gap-1">
          <Server size={12} /> System uptime: {overview?.systemUptime ?? "—"}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {!overview ? (
          Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label="Total Officers"
              value={String(overview.totalOfficers)}
              icon={Users}
              tone="navy"
              onClick={() => navigate("/admin/officers")}
            />
            <StatCard
              label="Active Officers"
              value={String(overview.activeOfficers)}
              icon={Activity}
              tone="green"
            />
            <StatCard
              label="Total Projects"
              value={overview.totalProjects.toLocaleString("en-IN")}
              icon={FolderKanban}
              tone="navy"
              onClick={() => navigate("/admin/projects")}
            />
            <StatCard
              label="Total Alerts"
              value={overview.totalAlerts.toLocaleString("en-IN")}
              icon={ShieldAlert}
              tone="amber"
              onClick={() => navigate("/admin/alerts")}
            />
            <StatCard
              label="Pending Citizen Reports"
              value={String(overview.pendingCitizenReports)}
              icon={MessageSquareWarning}
              tone="red"
              onClick={() => navigate("/admin/citizen-reports")}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {riskDist ? <RiskDistributionChart data={riskDist} /> : <CardSkeleton />}
        <Card className="lg:col-span-2" noPadding>
          <div className="p-5 pb-3 flex items-center justify-between">
            <div>
              <h3 className="font-semibold text-gray-900">Officer Roster Summary</h3>
              <p className="text-xs text-gray-500 mt-0.5">Status of registered monitoring officers</p>
            </div>
            <button onClick={() => navigate("/admin/officers")} className="text-xs font-medium text-navy-700 hover:underline">
              Manage officers
            </button>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 text-xs border-y border-gray-100">
                  <th className="py-2.5 px-5 font-medium">Officer</th>
                  <th className="py-2.5 px-3 font-medium">Jurisdiction</th>
                  <th className="py-2.5 px-3 font-medium">Projects</th>
                  <th className="py-2.5 px-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {(officers ?? []).slice(0, 5).map((o) => (
                  <tr key={o.id} className="border-b border-gray-50 last:border-0">
                    <td className="py-2.5 px-5 font-medium text-gray-800">{o.name}</td>
                    <td className="py-2.5 px-3 text-gray-500">{o.jurisdiction}</td>
                    <td className="py-2.5 px-3 text-gray-600">{o.projectsAssigned}</td>
                    <td className="py-2.5 px-3"><StatusBadge status={o.status === "Active" ? "Resolved" : "Delayed"} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      </div>

      {mapData && <IndiaRiskMap data={mapData} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">{alerts && <PriorityAlerts alerts={alerts} />}</div>
        <Card>
          <h3 className="font-semibold text-gray-900 mb-1">Recent Activity</h3>
          <p className="text-xs text-gray-500 mb-4">Latest system-wide actions</p>
          <div className="space-y-3">
            {(logs ?? []).map((l) => (
              <div key={l.id} className="flex items-start gap-2.5 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
                <span className="mt-1.5 w-1.5 h-1.5 rounded-full bg-navy-400 shrink-0" />
                <div className="min-w-0">
                  <p className="text-sm text-gray-700">
                    <span className="font-medium">{l.actor}</span> · {l.action}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">{l.target} · {formatDate(l.timestamp)}</p>
                </div>
              </div>
            ))}
          </div>
        </Card>
      </div>
    </div>
  );
}
