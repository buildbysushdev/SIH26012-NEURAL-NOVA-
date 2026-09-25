import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePortalBase } from "../lib/usePortalBase";
import { Search as SearchIcon, Download, RotateCcw, ArrowUpDown } from "lucide-react";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Button from "../components/ui/Button";
import Pagination from "../components/ui/Pagination";
import { RiskBadge, StatusBadge } from "../components/ui/Badge";
import { EmptyState, Skeleton } from "../components/ui/Feedback";
import { getProjects, type ProjectFilters } from "../services/api";
import { DISTRICTS_BY_STATE, ALL_CATEGORIES } from "../data/mockData";
import { formatINR } from "../lib/format";
import type { Project } from "../types";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

const STATUS_OPTIONS = ["Not Started", "In Progress", "Completed", "Delayed"];
const RISK_OPTIONS = ["Low", "Medium", "High", "Critical"];
const YEAR_OPTIONS = ["2024", "2025", "2026"];

export default function Projects() {
  const navigate = useNavigate();
  const portalBase = usePortalBase();
  const { showToast } = useToast();
  const { user } = useAuth();
  const [params, setParams] = useSearchParams();

  const isOfficer = user?.role === "officer" || !portalBase.includes("admin");
  const officerAssignedState = isOfficer ? (user?.assignedState || user?.jurisdiction || "Maharashtra") : "";

  const [filters, setFilters] = useState<ProjectFilters>({
    search: params.get("search") ?? "",
    state: isOfficer ? officerAssignedState : (params.get("state") ?? ""),
    district: params.get("district") ?? "",
    category: params.get("category") ?? "",
    status: params.get("status") ?? "",
    riskLevel: params.get("riskLevel") ?? "",
    year: params.get("year") ?? "",
  });
  const [page, setPage] = useState(1);
  const [sortBy, setSortBy] = useState<keyof Project>("riskScore");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [total, setTotal] = useState(0);
  const pageSize = 10;

  const effectiveState = isOfficer ? officerAssignedState : filters.state;
  const districtOptions = effectiveState ? DISTRICTS_BY_STATE[effectiveState] ?? [] : [];

  useEffect(() => {
    setProjects(null);
    getProjects({
      ...filters,
      state: isOfficer ? officerAssignedState : filters.state,
      page,
      pageSize,
      sortBy,
      sortDir,
    }).then((res) => {
      setProjects(res.data);
      setTotal(res.total);
    });
  }, [filters, page, sortBy, sortDir, isOfficer, officerAssignedState]);

  function updateFilter(key: keyof ProjectFilters, value: string) {
    if (isOfficer && key === "state") return;
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value, ...(key === "state" ? { district: "" } : {}) }));
  }

  function resetFilters() {
    setFilters({
      search: "",
      state: isOfficer ? officerAssignedState : "",
      district: "",
      category: "",
      status: "",
      riskLevel: "",
      year: "",
    });
    setParams({});
    setPage(1);
  }

  function toggleSort(field: keyof Project) {
    if (sortBy === field) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortBy(field);
      setSortDir("desc");
    }
  }

  function exportCSV() {
    if (!projects) return;
    const header = ["Project ID", "Name", "State", "District", "Category", "Sanctioned", "Expenditure", "Progress", "Risk Score", "Status"];
    const rows = projects.map((p) => [p.id, p.name, p.state, p.district, p.category, p.sanctionedAmount, p.expenditure, `${p.physicalProgress}%`, p.riskScore, p.status]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "mplads_projects_export.csv";
    a.click();
    URL.revokeObjectURL(url);
    showToast("Project data exported as CSV.", "success");
  }

  const SortHeader = ({ field, label }: { field: keyof Project; label: string }) => (
    <button onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-gray-700 dark:hover:text-white">
      {label} <ArrowUpDown size={11} className={sortBy === field ? "text-navy-700 dark:text-saffron-400" : "text-gray-300 dark:text-navy-600"} />
    </button>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold text-gray-900 dark:text-white">
            {isOfficer ? `State Projects — ${officerAssignedState}` : "Projects Master Directory"}
          </h2>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
            {isOfficer
              ? `Displaying works sanctioned exclusively under ${officerAssignedState} jurisdiction`
              : "Comprehensive registry of sanctioned works across all States and Union Territories"}
          </p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" icon={<RotateCcw size={14} />} onClick={resetFilters}>
            Reset
          </Button>
          <Button variant="secondary" icon={<Download size={14} />} onClick={exportCSV}>
            Export CSV
          </Button>
        </div>
      </div>

      <Card>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <div className="md:col-span-2">
            <Input
              placeholder="Search project ID, project name, location..."
              icon={<SearchIcon size={16} />}
              value={filters.search}
              onChange={(e) => updateFilter("search", e.target.value)}
            />
          </div>
          {isOfficer ? (
            <div className="flex items-center px-3 py-2 bg-gov-blue/10 dark:bg-navy-900 border border-gov-blue/30 dark:border-navy-700 rounded-md text-xs">
              <span className="text-gray-500 dark:text-gray-400 mr-2 font-medium">Assigned State:</span>
              <span className="font-bold text-gov-blue dark:text-saffron-400">{officerAssignedState}</span>
            </div>
          ) : (
            <Select
              placeholder="All States"
              options={[{ value: "", label: "All India" }, ...Object.keys(DISTRICTS_BY_STATE).map((s) => ({ value: s, label: s }))]}
              value={filters.state}
              onChange={(e) => updateFilter("state", e.target.value)}
            />
          )}
          <Select
            placeholder={isOfficer ? "All Districts" : "All Districts"}
            options={[{ value: "", label: "All Districts" }, ...districtOptions.map((d) => ({ value: d, label: d }))]}
            value={filters.district}
            onChange={(e) => updateFilter("district", e.target.value)}
            disabled={!isOfficer && !filters.state}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <Select
            placeholder="All Categories"
            options={[{ value: "", label: "All Categories" }, ...ALL_CATEGORIES.map((c) => ({ value: c, label: c }))]}
            value={filters.category}
            onChange={(e) => updateFilter("category", e.target.value)}
          />
          <Select
            placeholder="All Status"
            options={[{ value: "", label: "All Status" }, ...STATUS_OPTIONS.map((s) => ({ value: s, label: s }))]}
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
          />
          <Select
            placeholder="All Risk Levels"
            options={[{ value: "", label: "All Risk Levels" }, ...RISK_OPTIONS.map((r) => ({ value: r, label: r }))]}
            value={filters.riskLevel}
            onChange={(e) => updateFilter("riskLevel", e.target.value)}
          />
          <Select
            placeholder="All Years"
            options={[{ value: "", label: "All Years" }, ...YEAR_OPTIONS.map((y) => ({ value: y, label: y }))]}
            value={filters.year}
            onChange={(e) => updateFilter("year", e.target.value)}
          />
        </div>
      </Card>

      <Card noPadding className="overflow-hidden border border-gray-200 dark:border-navy-700">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left text-gray-600 dark:text-gray-300 text-xs border-b border-gray-200 dark:border-navy-700 bg-gray-50/80 dark:bg-navy-900">
                <th className="py-3 px-4 font-semibold">Project ID</th>
                <th className="py-3 px-3 font-semibold">Project Name</th>
                <th className="py-3 px-3 font-semibold">State</th>
                <th className="py-3 px-3 font-semibold">District</th>
                <th className="py-3 px-3 font-semibold">Category</th>
                <th className="py-3 px-3 font-semibold"><SortHeader field="sanctionedAmount" label="Sanctioned" /></th>
                <th className="py-3 px-3 font-semibold"><SortHeader field="expenditure" label="Expenditure" /></th>
                <th className="py-3 px-3 font-semibold"><SortHeader field="physicalProgress" label="Progress" /></th>
                <th className="py-3 px-3 font-semibold"><SortHeader field="riskScore" label="Risk Score" /></th>
                <th className="py-3 px-3 font-semibold">Status</th>
                <th className="py-3 px-4 font-semibold text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
              {!projects &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-100 dark:border-navy-800">
                    <td colSpan={11} className="py-3 px-4">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))}
              {projects?.map((p) => (
                <tr key={p.id} className="border-b border-gray-100 dark:border-navy-800 hover:bg-gray-50/80 dark:hover:bg-navy-800/60 transition-colors last:border-0">
                  <td className="py-3 px-4 font-semibold text-navy-800 dark:text-saffron-400 whitespace-nowrap">{p.id}</td>
                  <td className="py-3 px-3 text-gray-800 dark:text-gray-200 max-w-[200px] truncate">{p.name}</td>
                  <td className="py-3 px-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{p.state}</td>
                  <td className="py-3 px-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{p.district}</td>
                  <td className="py-3 px-3 text-gray-600 dark:text-gray-300 whitespace-nowrap">{p.category}</td>
                  <td className="py-3 px-3 text-gray-800 dark:text-gray-200 font-mono whitespace-nowrap">{formatINR(p.sanctionedAmount)}</td>
                  <td className="py-3 px-3 text-gray-800 dark:text-gray-200 font-mono whitespace-nowrap">{formatINR(p.expenditure)}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2 w-24">
                      <div className="flex-1 h-1.5 bg-gray-100 dark:bg-navy-950 rounded-full overflow-hidden">
                        <div className="h-full bg-gov-blue dark:bg-saffron-500 rounded-full" style={{ width: `${p.physicalProgress}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 dark:text-gray-400 w-8">{p.physicalProgress}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-800 dark:text-gray-200">{p.riskScore}</span>
                      <RiskBadge level={p.riskLevel} size="sm" />
                    </div>
                  </td>
                  <td className="py-3 px-3"><StatusBadge status={p.status} /></td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => navigate(`${portalBase}/projects/${p.id}`)} className="text-xs font-semibold text-gov-blue dark:text-saffron-400 hover:underline">
                      View
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {projects && projects.length === 0 && (
          <EmptyState title="No projects found" description="Try adjusting your filters or search term." />
        )}
        {projects && projects.length > 0 && (
          <Pagination page={page} pageSize={pageSize} total={total} onPageChange={setPage} />
        )}
      </Card>
    </div>
  );
}
