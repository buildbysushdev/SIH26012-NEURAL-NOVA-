import { useEffect, useState } from "react";
import { FolderKanban, ShieldAlert, Bell, Wallet, Clock } from "lucide-react";
import StatCard from "../components/dashboard/StatCard";
import RiskDistributionChart from "../components/dashboard/RiskDistributionChart";
import FundUtilizationChart from "../components/dashboard/FundUtilizationChart";
import ProjectStatusChart from "../components/dashboard/ProjectStatusChart";
import IndiaRiskMap from "../components/dashboard/IndiaRiskMap";
import PriorityAlerts from "../components/dashboard/PriorityAlerts";
import CitizenReportsWidget from "../components/dashboard/CitizenReportsWidget";
import AIInsightCard from "../components/dashboard/AIInsightCard";
import { CardSkeleton } from "../components/ui/Feedback";
import { useNavigate } from "react-router-dom";
import {
  getDashboardStats,
  getRiskDistribution,
  getProjectStatusBreakdown,
  getRiskAlerts,
  getCitizenReports,
  getRiskMapData,
  getAIInsights,
} from "../services/api";
import type { DashboardStats, RiskAlert, CitizenReport, StateRiskData } from "../types";

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [riskDist, setRiskDist] = useState<any[] | null>(null);
  const [statusData, setStatusData] = useState<any[] | null>(null);
  const [alerts, setAlerts] = useState<RiskAlert[] | null>(null);
  const [reports, setReports] = useState<CitizenReport[] | null>(null);
  const [mapData, setMapData] = useState<StateRiskData[] | null>(null);
  const [insights, setInsights] = useState<{ id: string; text: string }[] | null>(null);

  useEffect(() => {
    getDashboardStats().then(setStats);
    getRiskDistribution().then(setRiskDist);
    getProjectStatusBreakdown().then(setStatusData);
    getRiskAlerts({ status: "Open" }).then((a) => setAlerts(a.slice(0, 5)));
    getCitizenReports(4).then(setReports);
    getRiskMapData().then(setMapData);
    getAIInsights().then(setInsights);
  }, []);

  return (
    <div className="space-y-6 animate-fade-in">
      <div className="flex flex-col sm:flex-row sm:items-end justify-between gap-2">
        <div>
          <h2 className="text-xl font-bold text-gray-900">Good Morning, Officer</h2>
          <p className="text-sm text-gray-500 mt-0.5">Maharashtra • All Districts</p>
        </div>
        <p className="text-xs text-gray-400">
          Last data update:{" "}
          {stats ? new Date(stats.lastUpdated).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" }) : "—"}
        </p>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
        {!stats ? (
          Array.from({ length: 5 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            <StatCard
              label="Total Projects"
              value={stats.totalProjects.toLocaleString("en-IN")}
              trend={stats.totalProjectsTrend}
              icon={FolderKanban}
              tone="navy"
              onClick={() => navigate("/projects")}
            />
            <StatCard
              label="High Risk Projects"
              value={String(stats.highRiskProjects)}
              trend={stats.highRiskTrend}
              trendGoodDirection="down"
              icon={ShieldAlert}
              tone="red"
              onClick={() => navigate("/projects?riskLevel=High")}
            />
            <StatCard
              label="Active Alerts"
              value={stats.activeAlerts.toLocaleString("en-IN")}
              trend={stats.activeAlertsTrend}
              trendGoodDirection="down"
              icon={Bell}
              tone="amber"
              onClick={() => navigate("/alerts")}
            />
            <StatCard
              label="Fund Utilization"
              value={`${stats.fundUtilization}%`}
              trend={stats.fundUtilizationTrend}
              icon={Wallet}
              tone="green"
            />
            <StatCard
              label="Delayed Projects"
              value={String(stats.delayedProjects)}
              trend={stats.delayedTrend}
              trendGoodDirection="down"
              icon={Clock}
              tone="amber"
              onClick={() => navigate("/projects?status=Delayed")}
            />
          </>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">
          <FundUtilizationChart />
        </div>
        {riskDist ? <RiskDistributionChart data={riskDist} /> : <CardSkeleton />}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {statusData ? <ProjectStatusChart data={statusData} /> : <CardSkeleton />}
        <div className="lg:col-span-2">{insights && <AIInsightCard insights={insights} />}</div>
      </div>

      {mapData && <IndiaRiskMap data={mapData} />}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2">{alerts && <PriorityAlerts alerts={alerts} />}</div>
        {reports && <CitizenReportsWidget reports={reports} />}
      </div>
    </div>
  );
}
