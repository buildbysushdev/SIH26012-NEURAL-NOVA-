import { useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { usePortalBase } from "../lib/usePortalBase";
import { Search as SearchIcon, Download, RotateCcw, ArrowUpDown, X, ExternalLink, FileText } from "lucide-react";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
import Select from "../components/ui/Select";
import Button from "../components/ui/Button";
import Pagination from "../components/ui/Pagination";
import { RiskBadge, StatusBadge } from "../components/ui/Badge";
import { EmptyState, Skeleton } from "../components/ui/Feedback";
import { getProjects, getSatelliteImageUrl, getAuditBriefPdfUrl, type ProjectFilters } from "../services/api";
import { DISTRICTS_BY_STATE, ALL_CATEGORIES } from "../data/geography";
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
  const [satelliteModalProject, setSatelliteModalProject] = useState<Project | null>(null);

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
                  <td className="py-3 px-3 text-gray-800 dark:text-gray-200 max-w-[240px]">
                    <div className="font-medium truncate">{p.name}</div>
                    {p.satelliteStatus === "visible" && (
                      <button
                        type="button"
                        onClick={() => setSatelliteModalProject(p)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-emerald-100 hover:bg-emerald-200 text-emerald-800 dark:bg-emerald-950/80 dark:hover:bg-emerald-900 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700 mt-0.5 font-sans cursor-pointer transition-colors"
                        title="Click to view Sentinel-2 satellite image verification"
                      >
                        🛰️ Verified Genuine: Structure Present (View Proof)
                      </button>
                    )}
                    {p.satelliteStatus === "not_visible" && (
                      <button
                        type="button"
                        onClick={() => setSatelliteModalProject(p)}
                        className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-rose-100 hover:bg-rose-200 text-rose-800 dark:bg-rose-950/80 dark:hover:bg-rose-900 dark:text-rose-300 border border-rose-300 dark:border-rose-700 mt-0.5 font-sans cursor-pointer transition-colors"
                        title="Click to view Sentinel-2 anomaly scan"
                      >
                        ⚠️ Satellite Flagged: Structure Absent (View Proof)
                      </button>
                    )}
                  </td>
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
                  <td className="py-3 px-4 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1.5">
                      <button
                        type="button"
                        onClick={() => setSatelliteModalProject(p)}
                        className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/50 hover:bg-emerald-100 border border-emerald-300 dark:border-emerald-700 px-2 py-1 rounded transition-all cursor-pointer"
                        title="Inspect optical satellite scan"
                      >
                        🛰️ Satellite
                      </button>
                      <button
                        onClick={() => navigate(`${portalBase}/projects/${encodeURIComponent(p.id)}`)}
                        className="text-xs font-semibold text-gov-blue dark:text-saffron-400 hover:underline px-1.5 py-1"
                      >
                        View
                      </button>
                    </div>
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

      {/* ==================== SATELLITE VERIFICATION MODAL ==================== */}
      {satelliteModalProject && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-black/60 backdrop-blur-xs animate-in fade-in duration-150">
          <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[92vh]">
            {/* Tricolor Header */}
            <div className="h-1.5 w-full bg-gradient-to-r from-orange-500 via-white to-green-600" />
            
            {/* Modal Title Bar */}
            <div className="p-4 bg-[#0f172a] text-white flex items-center justify-between border-b border-gray-800">
              <div className="flex items-center gap-2.5">
                <span className="text-xl">🛰️</span>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    Sentinel-2 & High-Resolution Satellite Verification
                  </h3>
                  <p className="text-[11px] text-gray-400 font-mono">
                    {satelliteModalProject.id} · {satelliteModalProject.district}, {satelliteModalProject.state}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setSatelliteModalProject(null)}
                className="p-1.5 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors cursor-pointer"
              >
                <X size={18} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-5 overflow-y-auto space-y-4">
              {/* Satellite Image Display */}
              <div className="relative rounded-xl overflow-hidden border border-gray-300 dark:border-navy-700 bg-slate-950 shadow-md">
                <img
                  src={getSatelliteImageUrl(satelliteModalProject.id)}
                  alt="Satellite surveillance scan"
                  className="w-full h-auto object-cover max-h-[260px]"
                />
                <div className="absolute top-2.5 right-2.5 bg-black/75 backdrop-blur-md text-white text-[10px] font-mono px-2 py-0.5 rounded border border-white/20">
                  {satelliteModalProject.satellitePassDate ? `Pass Date: ${satelliteModalProject.satellitePassDate}` : "Sentinel-2 Multi-spectral"}
                </div>
              </div>

              {/* Status Comparison Badge & Explanation */}
              <div
                className={`p-3.5 rounded-xl border ${
                  satelliteModalProject.satelliteStatus === "visible"
                    ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                    : "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                }`}
              >
                <div className="flex items-center gap-2 font-bold text-sm">
                  {satelliteModalProject.satelliteStatus === "visible" ? (
                    <>
                      <span className="text-base">✅</span>
                      <span>Verified Genuine Work: Physical Structure Present On-Ground</span>
                    </>
                  ) : (
                    <>
                      <span className="text-base">⚠️</span>
                      <span>Surveillance Alert: Physical Structure Absent at Coordinates</span>
                    </>
                  )}
                </div>
                <p className="text-xs mt-1.5 leading-relaxed opacity-90">
                  {satelliteModalProject.satelliteStatus === "visible"
                    ? `Optical Sentinel-2 scan detects confirmed built structure at declared coordinates. Zero cost deviation and statutory timelines fulfilled. Risk Score: ${satelliteModalProject.riskScore}/100 (Low).`
                    : `Multi-spectral satellite sweep reveals NO physical structure constructed at reported location. Combined with high cost deviation, this project is flagged for mandatory on-site DISHA audit. Risk Score: ${satelliteModalProject.riskScore}/100.`}
                </p>
              </div>

              {/* Project Metadata Grid */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5 text-xs">
                <div className="p-2.5 bg-gray-50 dark:bg-navy-950 rounded-lg border border-gray-200 dark:border-navy-800">
                  <span className="text-[10px] text-gray-500 uppercase block">Sanctioned</span>
                  <span className="font-bold font-mono text-gray-900 dark:text-white">{formatINR(satelliteModalProject.sanctionedAmount)}</span>
                </div>
                <div className="p-2.5 bg-gray-50 dark:bg-navy-950 rounded-lg border border-gray-200 dark:border-navy-800">
                  <span className="text-[10px] text-gray-500 uppercase block">Work Category</span>
                  <span className="font-bold text-gray-900 dark:text-white truncate block">{satelliteModalProject.category}</span>
                </div>
                <div className="p-2.5 bg-gray-50 dark:bg-navy-950 rounded-lg border border-gray-200 dark:border-navy-800">
                  <span className="text-[10px] text-gray-500 uppercase block">Coordinates</span>
                  <span className="font-bold font-mono text-gray-900 dark:text-white truncate block">
                    {satelliteModalProject.latitude ? `${satelliteModalProject.latitude.toFixed(3)}°N, ${satelliteModalProject.longitude.toFixed(3)}°E` : "Locality Geocoded"}
                  </span>
                </div>
                <div className="p-2.5 bg-gray-50 dark:bg-navy-950 rounded-lg border border-gray-200 dark:border-navy-800">
                  <span className="text-[10px] text-gray-500 uppercase block">Risk Score</span>
                  <span className={`font-bold font-mono ${satelliteModalProject.riskScore >= 60 ? "text-rose-600" : "text-emerald-600"}`}>
                    {satelliteModalProject.riskScore}/100
                  </span>
                </div>
              </div>

              {/* Full Description */}
              <div className="text-xs text-gray-700 dark:text-gray-300 bg-gray-50 dark:bg-navy-950 p-3 rounded-lg border border-gray-200 dark:border-navy-800">
                <span className="font-bold text-gray-900 dark:text-white block mb-0.5">Work Description:</span>
                <p>{satelliteModalProject.name}</p>
              </div>
            </div>

            {/* Modal Footer */}
            <div className="p-3.5 bg-gray-50 dark:bg-navy-950 border-t border-gray-200 dark:border-navy-800 flex items-center justify-between gap-3">
              <a
                href={getAuditBriefPdfUrl(satelliteModalProject.id)}
                target="_blank"
                rel="noreferrer"
                className="inline-flex items-center gap-1.5 text-xs font-semibold px-3 py-2 bg-indigo-600 hover:bg-indigo-700 text-white rounded-lg transition-colors"
              >
                <FileText size={14} />
                Download Audit Brief (PDF)
              </a>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSatelliteModalProject(null)}
                >
                  Close
                </Button>
                <button
                  onClick={() => navigate(`${portalBase}/projects/${encodeURIComponent(satelliteModalProject.id)}`)}
                  className="inline-flex items-center gap-1 text-xs font-semibold text-white bg-[#0b2545] hover:bg-navy-800 px-3 py-2 rounded-lg transition-all cursor-pointer"
                >
                  Open Dossier
                  <ExternalLink size={13} />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
