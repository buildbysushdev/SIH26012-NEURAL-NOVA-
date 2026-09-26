import { useEffect, useState, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { usePortalBase } from "../lib/usePortalBase";
import { useAuth } from "../context/AuthContext";
import {
  FolderKanban,
  ShieldAlert,
  MessageSquareWarning,
  Activity,
  Search,
  RotateCcw,
  ChevronRight,
  Filter,
  IndianRupee,
  FolderCheck,
  MapPin,
  Building2,
} from "lucide-react";
import Card from "../components/ui/Card";
import GovPageHeader from "../components/layout/GovPageHeader";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Button from "../components/ui/Button";
import Pagination from "../components/ui/Pagination";
import StatCard from "../components/dashboard/StatCard";
import RiskDistributionChart from "../components/dashboard/RiskDistributionChart";
import CitizenReportsWidget from "../components/dashboard/CitizenReportsWidget";
import AIInsightCard from "../components/dashboard/AIInsightCard";
import { RiskBadge } from "../components/ui/Badge";
import { CardSkeleton } from "../components/ui/Feedback";
import {
  getDashboardStats,
  getFlaggedProjects,
  getCitizenReports,
  getAIInsights,
  type ProjectFilters,
} from "../services/api";
import { DISTRICTS_BY_STATE, ALL_CATEGORIES } from "../data/geography";
import type { DashboardStats, Project, CitizenReport } from "../types";

const RISK_LEVEL_OPTIONS = [
  { value: "All", label: "All Risk Levels" },
  { value: "Critical", label: "Critical" },
  { value: "High", label: "High" },
  { value: "Medium", label: "Medium" },
  { value: "Low", label: "Low" },
];

export default function Dashboard() {
  const navigate = useNavigate();
  const portalBase = usePortalBase();
  const { user } = useAuth();

  // SECTION 2C: STRICT STATE SCOPING FOR OFFICER
  const assignedState = user?.assignedState || "Maharashtra";

  // Top KPIs & secondary widgets state
  const [stats, setStats] = useState<DashboardStats | null>(null);
  const [reports, setReports] = useState<CitizenReport[] | null>(null);
  const [insights, setInsights] = useState<{ id: string; text: string }[] | null>(null);

  // Main Flagged Projects Section state
  const [flaggedProjects, setFlaggedProjects] = useState<Project[] | null>(null);
  const [flaggedTotal, setFlaggedTotal] = useState(0);
  const [page, setPage] = useState(1);
  const pageSize = 10;

  // Filters for Flagged Projects - state locked to assignedState
  const [filters, setFilters] = useState<ProjectFilters>({
    search: "",
    state: assignedState,
    district: "All",
    riskLevel: "All",
    category: "All",
    status: "All",
  });

  // Keep state filter synced if user switches
  useEffect(() => {
    setFilters((f) => ({ ...f, state: assignedState, district: "All" }));
  }, [assignedState]);

  // Initial load for dashboard KPIs and background widgets
  useEffect(() => {
    getDashboardStats(assignedState).then(setStats);
    getCitizenReports(20).then(setReports);
    getAIInsights(assignedState).then(setInsights);
  }, [assignedState]);

  // Fetch Flagged Projects whenever filters or page changes
  useEffect(() => {
    setFlaggedProjects(null);
    getFlaggedProjects({
      ...filters,
      state: assignedState, // HARD ENFORCED
      page,
      pageSize,
    }).then((res) => {
      setFlaggedProjects(res.data);
      setFlaggedTotal(res.total);
    });
  }, [filters, page, assignedState]);

  function handleFilterChange(key: keyof ProjectFilters, value: string) {
    setPage(1);
    setFilters((prev) => ({ ...prev, [key]: value }));
  }

  function handleResetFilters() {
    setFilters({
      search: "",
      state: assignedState,
      district: "All",
      riskLevel: "All",
      category: "All",
      status: "All",
    });
    setPage(1);
  }

  // Scoped projects for assignedState
  const scopedStateProjects = useMemo(() => {
    return (flaggedProjects || []).filter((p) => p.state.toLowerCase() === assignedState.toLowerCase());
  }, [assignedState, flaggedProjects]);

  // Two new KPI cards scoped to officer's state (Section 2C)
  const stateExpenditure = stats?.totalDisbursed ?? 0;

  const stateSanctionedCount = stats?.totalProjects ?? 0;

  const formattedStateExpenditure = useMemo(() => {
    if (stateExpenditure >= 10000000) {
      return `₹${(stateExpenditure / 10000000).toFixed(2)} Cr`;
    }
    return `₹${(stateExpenditure / 100000).toFixed(2)} L`;
  }, [stateExpenditure]);

  // Reactive risk distribution chart data for assignedState
  const scopedRiskDist = useMemo(() => {
    const low = scopedStateProjects.filter((p) => p.riskLevel === "Low").length;
    const medium = scopedStateProjects.filter((p) => p.riskLevel === "Medium").length;
    const high = scopedStateProjects.filter((p) => p.riskLevel === "High").length;
    const critical = scopedStateProjects.filter((p) => p.riskLevel === "Critical").length;
    return [
      { name: "Low", value: low, color: "#16a34a" },
      { name: "Medium", value: medium, color: "#d97706" },
      { name: "High", value: high, color: "#ea580c" },
      { name: "Critical", value: critical, color: "#dc2626" },
    ];
  }, [scopedStateProjects]);

  // District options exclusively for the officer's assigned state
  const districtOptions = useMemo(() => {
    const list = DISTRICTS_BY_STATE[assignedState] || [];
    return [{ value: "All", label: "All Districts" }, ...list.map((d) => ({ value: d, label: d }))];
  }, [assignedState]);

  const categoryOptions = [
    { value: "All", label: "All Categories" },
    ...ALL_CATEGORIES.map((c) => ({ value: c, label: c })),
  ];

  return (
    <div className="space-y-5 animate-fade-in pb-10">
      {/* Dashboard Top Header — GovPageHeader with MoSPI identity */}
      <GovPageHeader
        title={`State Risk Intelligence Dashboard · राज्य निगरानी`}
        subtitle={`Officer ID: ${user?.id || "OFF-001"} · MPLADS data feed`}
        description={`Dataset-derived analytics scoped to ${assignedState} · DISHA Vigilance Portal`}
        scopeBadge={`Jurisdiction: ${assignedState}`}
        statusDot="green"
        rightContent={
          <div className="text-right">
            <p className="text-[11px] font-medium text-gray-500">
              Surveillance Sync: {stats ? new Date(stats.lastUpdated).toLocaleDateString("en-IN") : "Active"}
            </p>
            <span className="inline-flex items-center gap-1.5 text-xs text-emerald-700 font-semibold mt-0.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-600" /> State Scoped Telemetry Active
            </span>
          </div>
        }
      />

      {/* 1. TOP KPI SECTION: 6 Cards including the 2 new requested cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        {!stats ? (
          Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
        ) : (
          <>
            {/* NEW KPI CARD 1: Total State Expenditure */}
            <StatCard
              label="State Expenditure"
              value={formattedStateExpenditure}
              icon={IndianRupee}
              tone="green"
            />

            {/* NEW KPI CARD 2: Total Sanctioned Projects */}
            <StatCard
              label="Sanctioned Projects"
              value={stateSanctionedCount.toLocaleString("en-IN")}
              icon={FolderCheck}
              tone="navy"
              onClick={() => navigate(`${portalBase}/projects`)}
            />

            {/* Total Scanned within state */}
            <StatCard
              label="Projects Scanned"
              value={stateSanctionedCount.toLocaleString("en-IN")}
              icon={FolderKanban}
              tone="navy"
              onClick={() => navigate(`${portalBase}/projects`)}
            />

            {/* High-Risk Flagged within state */}
            <StatCard
              label="High-Risk Flagged"
              value={String(stats.highRiskFlaggedCount ?? 0)}
              icon={ShieldAlert}
              tone="red"
              onClick={() => handleFilterChange("riskLevel", "High")}
            />

            {/* Citizen Reports Received within state */}
            <StatCard
              label="Citizen Reports"
              value={String(reports?.length ?? 0)}
              icon={MessageSquareWarning}
              tone="amber"
              onClick={() => navigate(`${portalBase}/alerts`)}
            />

            {/* Average Risk Score */}
            <StatCard
              label="Avg Risk Score"
              value={`${Math.round(stats.avgRiskScore ?? 0)}/100`}
              icon={Activity}
              tone="navy"
            />
          </>
        )}
      </div>

      {/* 2. FLAGGED PROJECTS — MAIN FOCUS */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-white dark:bg-navy-900 p-4 rounded-md border border-gray-200 dark:border-navy-800 shadow-sm">
          <div>
            <div className="flex items-center gap-2">
              <h2 className="text-base font-bold text-gray-900 dark:text-gray-100">
                Priority Flagged Projects ({assignedState})
              </h2>
              <span className="bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 text-xs font-semibold px-2 py-0.5 rounded border border-red-200 dark:border-red-800">
                {flaggedTotal} Flagged in Jurisdiction
              </span>
            </div>
            <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
              Ranked by composite anomaly score · Exclusively scoped to {assignedState}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" icon={<RotateCcw size={13} />} onClick={handleResetFilters}>
              Reset Filters
            </Button>
            <Button
              variant="secondary"
              size="sm"
              icon={<ChevronRight size={14} />}
              onClick={() => navigate(`${portalBase}/projects`)}
            >
              All Projects ({assignedState})
            </Button>
          </div>
        </div>

        {/* 6. SIMPLE FILTERS (No State Selector — Replaced with Read-Only Assigned State Label) */}
        <Card className="p-3.5 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800">
          <div className="flex items-center gap-1.5 mb-2.5 text-xs font-bold text-gray-700 dark:text-gray-300 uppercase tracking-wide">
            <Filter size={13} className="text-[#0b2545] dark:text-amber-400" />
            <span>Filter Priority Projects in {assignedState}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
            {/* Search Input */}
            <div className="lg:col-span-1">
              <Input
                placeholder="Search Work ID, name..."
                icon={<Search size={14} />}
                value={filters.search}
                onChange={(e) => handleFilterChange("search", e.target.value)}
              />
            </div>

            {/* Read-Only State Label (Replaces State Dropdown per Section 2C) */}
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                State (Fixed)
              </span>
              <div className="h-9 px-3 rounded border border-navy-200 dark:border-navy-700 bg-navy-50 dark:bg-navy-900 text-xs font-bold text-navy-900 dark:text-amber-400 flex items-center gap-1.5">
                <MapPin size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">{assignedState}</span>
              </div>
            </div>

            {/* District Filter: Only lists districts of assigned state */}
            <div>
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1 block">
                District Filter
              </span>
              <Select
                placeholder="All Districts"
                options={districtOptions}
                value={filters.district || "All"}
                onChange={(e) => handleFilterChange("district", e.target.value)}
              />
            </div>

            {/* Risk Level Filter */}
            <div>
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1 block">
                Risk Severity
              </span>
              <Select
                placeholder="All Risk Levels"
                options={RISK_LEVEL_OPTIONS}
                value={filters.riskLevel}
                onChange={(e) => handleFilterChange("riskLevel", e.target.value)}
              />
            </div>

            {/* Work Category Filter */}
            <div>
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1 block">
                Work Category
              </span>
              <Select
                placeholder="All Categories"
                options={categoryOptions}
                value={filters.category}
                onChange={(e) => handleFilterChange("category", e.target.value)}
              />
            </div>
          </div>
        </Card>

        {/* Flagged Projects Data Table */}
        <Card noPadding className="overflow-hidden border border-gray-200 dark:border-navy-800">
          <div className="overflow-x-auto">
            <table className="w-full text-xs min-w-[850px]">
              <thead>
                <tr className="bg-gray-50 dark:bg-navy-950 text-gray-500 dark:text-gray-400 uppercase tracking-wider text-left border-b border-gray-100 dark:border-navy-800 font-semibold">
                  <th className="py-3 px-4">Project / Work ID</th>
                  <th className="py-3 px-3">Location ({assignedState})</th>
                  <th className="py-3 px-3 text-center">Risk Score</th>
                  <th className="py-3 px-3">Risk Level</th>
                  <th className="py-3 px-4">Surveillance Finding</th>
                  <th className="py-3 px-4 text-right">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
                {!flaggedProjects ? (
                  Array.from({ length: 5 }).map((_, i) => (
                    <tr key={i}>
                      <td colSpan={6} className="py-3.5 px-4">
                        <div className="h-5 bg-gray-100 dark:bg-navy-800 rounded animate-pulse w-full" />
                      </td>
                    </tr>
                  ))
                ) : flaggedProjects.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="py-12 text-center text-gray-400">
                      No high-risk flagged works found in {assignedState} matching current filters.
                    </td>
                  </tr>
                ) : (
                  flaggedProjects.map((p) => {
                    const isFalsePositive = p.feedbackStatus === "false_positive";
                    const isConfirmed = p.feedbackStatus === "confirmed_issue";

                    return (
                      <tr
                        key={p.id}
                        className="hover:bg-gray-50 dark:hover:bg-navy-800/40 transition-colors"
                      >
                        <td className="py-3 px-4">
                          <p className="font-bold text-gray-900 dark:text-gray-100 hover:text-navy-700 dark:hover:text-amber-400 transition-colors">
                            {p.name}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5 text-[11px] text-gray-500 font-mono">
                            <span>{p.id}</span>
                            <span>•</span>
                            <span className="text-gray-600 dark:text-gray-400 font-sans">{p.category}</span>
                          </div>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <p className="font-semibold text-gray-800 dark:text-gray-200">{p.district}</p>
                          <p className="text-[10px] text-gray-400 font-semibold">{assignedState}</p>
                        </td>

                        <td className="py-3 px-3 text-center whitespace-nowrap">
                          <span
                            className={`font-black text-xs ${
                              p.riskScore >= 80
                                ? "text-red-600 dark:text-red-400"
                                : p.riskScore >= 60
                                ? "text-amber-600 dark:text-amber-400"
                                : "text-emerald-600"
                            }`}
                          >
                            {p.riskScore}/100
                          </span>
                        </td>

                        <td className="py-3 px-3 whitespace-nowrap">
                          <RiskBadge
                            level={isFalsePositive ? "False Positive" : isConfirmed ? "Reviewed" : p.riskLevel}
                            size="sm"
                          />
                        </td>

                        <td className="py-3 px-4 max-w-[320px]">
                          <div className="text-xs text-gray-700 dark:text-gray-300 leading-snug p-2 rounded bg-gray-50 dark:bg-navy-950 border border-gray-100 dark:border-navy-800">
                            {p.flagReason || p.aiExplanation || "Composite multi-signal risk threshold exceeded."}
                          </div>
                        </td>

                        <td className="py-3 px-4 text-right whitespace-nowrap">
                          <button
                            onClick={() => navigate(`${portalBase}/projects/${encodeURIComponent(p.id)}`)}
                            className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#0b2545] hover:bg-navy-800 px-2.5 py-1.5 rounded transition-all"
                          >
                            View Details
                            <ChevronRight size={13} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>

          {flaggedProjects && flaggedProjects.length > 0 && (
            <Pagination page={page} pageSize={pageSize} total={flaggedTotal} onPageChange={setPage} />
          )}
        </Card>
      </div>

      {/* 3. JURISDICTION OVERVIEW & REASONING WIDGETS */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5 pt-2">
        <div className="lg:col-span-1">
          <RiskDistributionChart data={scopedRiskDist} />
        </div>
        <div className="lg:col-span-2">
          {insights && <AIInsightCard insights={insights} />}
        </div>
      </div>

      {/* Citizen Reports Widget Scoped to Assigned State */}
      {reports && reports.length > 0 && (
        <div className="mt-4">
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={16} className="text-[#0b2545] dark:text-amber-400" />
            <h3 className="text-xs font-bold text-gray-800 dark:text-gray-200 uppercase tracking-wide">
              Public Grievances & Citizen Signals ({assignedState})
            </h3>
          </div>
          <CitizenReportsWidget reports={reports} />
        </div>
      )}
    </div>
  );
}
