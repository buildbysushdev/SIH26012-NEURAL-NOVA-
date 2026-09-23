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

const STATUS_OPTIONS = ["Not Started", "In Progress", "Completed", "Delayed"];
const RISK_OPTIONS = ["Low", "Medium", "High", "Critical"];
const YEAR_OPTIONS = ["2024", "2025", "2026"];

export default function Projects() {
  const navigate = useNavigate();
  const portalBase = usePortalBase();
  const { showToast } = useToast();
  const [params, setParams] = useSearchParams();

  const [filters, setFilters] = useState<ProjectFilters>({
    search: params.get("search") ?? "",
    state: params.get("state") ?? "",
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

  const districtOptions = filters.state ? DISTRICTS_BY_STATE[filters.state] ?? [] : [];

  useEffect(() => {
    setProjects(null);
    getProjects({ ...filters, page, pageSize, sortBy, sortDir }).then((res) => {
      setProjects(res.data);
      setTotal(res.total);
    });
  }, [filters, page, sortBy, sortDir]);

  function updateFilter(key: keyof ProjectFilters, value: string) {
    setPage(1);
    setFilters((f) => ({ ...f, [key]: value, ...(key === "state" ? { district: "" } : {}) }));
  }

  function resetFilters() {
    setFilters({ search: "", state: "", district: "", category: "", status: "", riskLevel: "", year: "" });
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
    <button onClick={() => toggleSort(field)} className="flex items-center gap-1 hover:text-gray-700">
      {label} <ArrowUpDown size={11} className={sortBy === field ? "text-navy-700" : "text-gray-300"} />
    </button>
  );

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900">Projects</h2>
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
          <Select
            placeholder="All States"
            options={Object.keys(DISTRICTS_BY_STATE).map((s) => ({ value: s, label: s }))}
            value={filters.state}
            onChange={(e) => updateFilter("state", e.target.value)}
          />
          <Select
            placeholder="All Districts"
            options={districtOptions.map((d) => ({ value: d, label: d }))}
            value={filters.district}
            onChange={(e) => updateFilter("district", e.target.value)}
            disabled={!filters.state}
          />
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mt-3">
          <Select
            placeholder="All Categories"
            options={ALL_CATEGORIES.map((c) => ({ value: c, label: c }))}
            value={filters.category}
            onChange={(e) => updateFilter("category", e.target.value)}
          />
          <Select
            placeholder="All Status"
            options={STATUS_OPTIONS.map((s) => ({ value: s, label: s }))}
            value={filters.status}
            onChange={(e) => updateFilter("status", e.target.value)}
          />
          <Select
            placeholder="All Risk Levels"
            options={RISK_OPTIONS.map((r) => ({ value: r, label: r }))}
            value={filters.riskLevel}
            onChange={(e) => updateFilter("riskLevel", e.target.value)}
          />
          <Select
            placeholder="All Years"
            options={YEAR_OPTIONS.map((y) => ({ value: y, label: y }))}
            value={filters.year}
            onChange={(e) => updateFilter("year", e.target.value)}
          />
        </div>
      </Card>

      <Card noPadding className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[900px]">
            <thead>
              <tr className="text-left text-gray-400 text-xs border-b border-gray-100 bg-gray-50/50">
                <th className="py-3 px-4 font-medium">Project ID</th>
                <th className="py-3 px-3 font-medium">Project Name</th>
                <th className="py-3 px-3 font-medium">State</th>
                <th className="py-3 px-3 font-medium">District</th>
                <th className="py-3 px-3 font-medium">Category</th>
                <th className="py-3 px-3 font-medium"><SortHeader field="sanctionedAmount" label="Sanctioned" /></th>
                <th className="py-3 px-3 font-medium"><SortHeader field="expenditure" label="Expenditure" /></th>
                <th className="py-3 px-3 font-medium"><SortHeader field="physicalProgress" label="Progress" /></th>
                <th className="py-3 px-3 font-medium"><SortHeader field="riskScore" label="Risk Score" /></th>
                <th className="py-3 px-3 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {!projects &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td colSpan={11} className="py-3 px-4">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))}
              {projects?.map((p) => (
                <tr key={p.id} className="border-b border-gray-50 hover:bg-gray-50 last:border-0">
                  <td className="py-3 px-4 font-medium text-navy-800 whitespace-nowrap">{p.id}</td>
                  <td className="py-3 px-3 text-gray-700 max-w-[200px] truncate">{p.name}</td>
                  <td className="py-3 px-3 text-gray-600 whitespace-nowrap">{p.state}</td>
                  <td className="py-3 px-3 text-gray-600 whitespace-nowrap">{p.district}</td>
                  <td className="py-3 px-3 text-gray-600 whitespace-nowrap">{p.category}</td>
                  <td className="py-3 px-3 text-gray-700 whitespace-nowrap">{formatINR(p.sanctionedAmount)}</td>
                  <td className="py-3 px-3 text-gray-700 whitespace-nowrap">{formatINR(p.expenditure)}</td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-2 w-24">
                      <div className="flex-1 h-1.5 bg-gray-100 rounded-full overflow-hidden">
                        <div className="h-full bg-navy-700 rounded-full" style={{ width: `${p.physicalProgress}%` }} />
                      </div>
                      <span className="text-xs text-gray-500 w-8">{p.physicalProgress}%</span>
                    </div>
                  </td>
                  <td className="py-3 px-3">
                    <div className="flex items-center gap-1.5">
                      <span className="font-semibold text-gray-800">{p.riskScore}</span>
                      <RiskBadge level={p.riskLevel} size="sm" />
                    </div>
                  </td>
                  <td className="py-3 px-3"><StatusBadge status={p.status} /></td>
                  <td className="py-3 px-4 text-right">
                    <button onClick={() => navigate(`${portalBase}/projects/${p.id}`)} className="text-xs font-medium text-navy-700 hover:underline">
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
