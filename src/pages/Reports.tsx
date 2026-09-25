import { useState, useEffect, useMemo } from "react";
import {
  FileText,
  Download,
  Eye,
  Inbox,
  Send,
  Building2,
  CheckCircle2,
  Calendar,
} from "lucide-react";
import Card from "../components/ui/Card";
import Select from "../components/ui/Select";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import { Skeleton, EmptyState } from "../components/ui/Feedback";
import {
  generateReport,
  getSubmittedOfficerReports,
  submitReportToAdmin,
  type SubmittedOfficerReport,
} from "../services/api";
import { PROJECTS, DISTRICTS_BY_STATE } from "../data/mockData";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import clsx from "clsx";

const REPORT_TYPES = [
  "Risk Summary",
  "Project-wise",
  "Financial Anomalies",
  "Delayed Projects",
  "Duplicate Projects",
  "District Report",
  "State Report",
  "Complete MPLADS Report",
];

export default function Reports() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isSuperAdmin = user?.role === "super_admin";

  // Active tab: Super Admin defaults to "received" or "generate", Officer has only "generate"
  const [activeTab, setActiveTab] = useState<"received" | "generate">(
    isSuperAdmin ? "received" : "generate"
  );

  // ---------------- Received Reports State (Super Admin) ----------------
  const [receivedReports, setReceivedReports] = useState<SubmittedOfficerReport[]>([]);
  const [loadingReceived, setLoadingReceived] = useState(false);
  const [receivedStateFilter, setReceivedStateFilter] = useState("All States");
  const [receivedDistrictFilter, setReceivedDistrictFilter] = useState("All Districts");
  const [selectedReceivedReport, setSelectedReceivedReport] = useState<SubmittedOfficerReport | null>(null);

  // ---------------- Generate Report State ----------------
  const [type, setType] = useState(REPORT_TYPES[0]);
  const [state, setState] = useState(() => (isSuperAdmin ? "" : user?.assignedState || ""));
  const [district, setDistrict] = useState("");
  const [selectedProjectId, setSelectedProjectId] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [sendingToAdmin, setSendingToAdmin] = useState(false);
  const [report, setReport] = useState<Awaited<ReturnType<typeof generateReport>> | null>(null);

  // Load received reports for Super Admin
  useEffect(() => {
    if (isSuperAdmin) {
      setLoadingReceived(true);
      getSubmittedOfficerReports()
        .then(setReceivedReports)
        .finally(() => setLoadingReceived(false));
    }
  }, [isSuperAdmin]);

  // Keep state locked for officers
  useEffect(() => {
    if (!isSuperAdmin && user?.assignedState) {
      setState(user.assignedState);
    }
  }, [isSuperAdmin, user?.assignedState]);

  // Filtered projects for Project-wise selector
  const availableProjectsForSelection = useMemo(() => {
    let pool = PROJECTS;
    if (!isSuperAdmin && user?.assignedState) {
      pool = pool.filter((p) => p.state.toLowerCase() === user.assignedState?.toLowerCase());
    } else if (state && state !== "All States") {
      pool = pool.filter((p) => p.state.toLowerCase() === state.toLowerCase());
    }
    if (district && district !== "All Districts") {
      pool = pool.filter((p) => p.district.toLowerCase() === district.toLowerCase());
    }
    return pool;
  }, [isSuperAdmin, user?.assignedState, state, district]);

  // Filtered received reports for Super Admin
  const filteredReceivedReports = useMemo(() => {
    return receivedReports.filter((r) => {
      const matchState =
        receivedStateFilter === "All States" ||
        r.state.toLowerCase() === receivedStateFilter.toLowerCase();
      const matchDistrict =
        receivedDistrictFilter === "All Districts" ||
        r.district.toLowerCase() === receivedDistrictFilter.toLowerCase();
      return matchState && matchDistrict;
    });
  }, [receivedReports, receivedStateFilter, receivedDistrictFilter]);

  async function handleGenerate() {
    setLoading(true);
    setReport(null);
    const effectiveState = !isSuperAdmin ? user?.assignedState || state : state;
    const res = await generateReport({
      type,
      state: effectiveState,
      district,
      riskLevel,
      dateFrom,
      dateTo,
      projectId: type === "Project-wise" ? selectedProjectId : undefined,
    });
    setReport(res);
    setLoading(false);
    showToast("Official report generated successfully.", "success");
  }

  // Officer action: Send generated report to Super Admin (Section 2G & 1G)
  async function handleSendToSuperAdmin() {
    if (!report) return;
    setSendingToAdmin(true);
    const selectedProj = PROJECTS.find((p) => p.id === selectedProjectId);
    await submitReportToAdmin({
      officerName: user?.name || "State Monitoring Officer",
      officerEmail: user?.email || "officer@mplads.ai",
      state: user?.assignedState || state || "Maharashtra",
      district: district || selectedProj?.district || "Statewide",
      reportType: type,
      projectName: selectedProj ? `${selectedProj.id} — ${selectedProj.name}` : undefined,
      summary: report.summary,
      rows: report.rows,
    });
    setSendingToAdmin(false);
    showToast("Report officially transmitted to MoSPI Super Admin Console.", "success");
    // Reload received reports if admin was switching tabs
    getSubmittedOfficerReports().then(setReceivedReports);
  }

  function downloadCSV(data?: { title: string; rows: { project: string; risk: string; amount: string }[] }) {
    const target = data || report;
    if (!target) return;
    const header = ["Project", "Risk Score / Level", "Amount"];
    const rows = target.rows.map((r) => [r.project, r.risk, r.amount]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${target.title.replace(/[^a-zA-Z0-9]/g, "_").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Report exported as CSV.", "success");
  }

  return (
    <div className="space-y-5 animate-fade-in">
      {/* Page Header with Official Navigation */}
      <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800 rounded-md p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-[#0b2545] dark:text-amber-400" />
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
              Statutory Reports & Dossiers · प्रतिवेदन
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {isSuperAdmin
              ? "Review field audit submissions from state officers or generate central compliance reports"
              : `Generate state compliance dossiers for ${user?.assignedState || "assigned jurisdiction"} and submit to MoSPI`}
          </p>
        </div>

        {/* Tab switch for Super Admin (Received Reports vs Generate Report) */}
        {isSuperAdmin && (
          <div className="flex items-center bg-gray-100 dark:bg-navy-800 p-1 rounded-md text-xs font-semibold shrink-0">
            <button
              onClick={() => setActiveTab("received")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                activeTab === "received"
                  ? "bg-white dark:bg-navy-950 text-navy-950 dark:text-amber-400 shadow-sm font-bold"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              <Inbox size={14} /> Received Reports ({receivedReports.length})
            </button>
            <button
              onClick={() => setActiveTab("generate")}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded transition-colors ${
                activeTab === "generate"
                  ? "bg-white dark:bg-navy-950 text-navy-950 dark:text-amber-400 shadow-sm font-bold"
                  : "text-gray-600 dark:text-gray-400 hover:text-gray-900"
              }`}
            >
              <FileText size={14} /> Generate Central Report
            </button>
          </div>
        )}
      </div>

      {/* ===================== TAB 1: RECEIVED REPORTS (SUPER ADMIN) ===================== */}
      {isSuperAdmin && activeTab === "received" && (
        <div className="space-y-4 animate-fade-in">
          {/* Filters for Received Reports */}
          <Card>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <Select
                label="Filter by Officer State"
                options={["All States", ...Object.keys(DISTRICTS_BY_STATE).sort()].map((s) => ({
                  value: s,
                  label: s,
                }))}
                value={receivedStateFilter}
                onChange={(e) => {
                  setReceivedStateFilter(e.target.value);
                  setReceivedDistrictFilter("All Districts");
                }}
              />
              <Select
                label="Filter by District"
                options={[
                  "All Districts",
                  ...(receivedStateFilter !== "All States" && DISTRICTS_BY_STATE[receivedStateFilter]
                    ? DISTRICTS_BY_STATE[receivedStateFilter]
                    : []),
                ].map((d) => ({ value: d, label: d }))}
                value={receivedDistrictFilter}
                onChange={(e) => setReceivedDistrictFilter(e.target.value)}
                disabled={receivedStateFilter === "All States"}
              />
              <div className="flex items-end">
                <span className="text-xs text-gray-500 dark:text-gray-400 pb-2">
                  Showing {filteredReceivedReports.length} submitted dossiers
                </span>
              </div>
            </div>
          </Card>

          {/* Received Reports Table */}
          <Card noPadding className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-xs min-w-[850px]">
                <thead>
                  <tr className="text-left text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-navy-950 border-b border-gray-100 dark:border-navy-800">
                    <th className="py-3 px-4 font-semibold">Submitting Officer</th>
                    <th className="py-3 px-3 font-semibold">State</th>
                    <th className="py-3 px-3 font-semibold">District</th>
                    <th className="py-3 px-3 font-semibold">Report Type</th>
                    <th className="py-3 px-3 font-semibold">Project Scope</th>
                    <th className="py-3 px-3 font-semibold">Submission Date</th>
                    <th className="py-3 px-4 font-semibold text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
                  {loadingReceived &&
                    Array.from({ length: 4 }).map((_, i) => (
                      <tr key={i}>
                        <td colSpan={7} className="py-3 px-4">
                          <Skeleton className="h-5 w-full" />
                        </td>
                      </tr>
                    ))}
                  {!loadingReceived &&
                    filteredReceivedReports.map((rec) => (
                      <tr key={rec.id} className="hover:bg-gray-50 dark:hover:bg-navy-800/40 transition-colors">
                        <td className="py-3 px-4">
                          <p className="font-semibold text-gray-900 dark:text-gray-100">{rec.officerName}</p>
                          <p className="text-[11px] text-gray-500 dark:text-gray-400 font-mono">{rec.officerEmail}</p>
                        </td>
                        <td className="py-3 px-3">
                          <span className="inline-block px-2 py-0.5 rounded font-semibold text-[11px] bg-navy-50 dark:bg-navy-800 text-navy-800 dark:text-amber-400 border border-navy-200 dark:border-navy-700">
                            {rec.state}
                          </span>
                        </td>
                        <td className="py-3 px-3 text-gray-700 dark:text-gray-300 font-medium">{rec.district}</td>
                        <td className="py-3 px-3 font-medium text-gray-800 dark:text-gray-200">{rec.reportType}</td>
                        <td className="py-3 px-3 text-gray-600 dark:text-gray-400 max-w-[200px] truncate">
                          {rec.projectName || "General State Assessment"}
                        </td>
                        <td className="py-3 px-3 text-gray-500 dark:text-gray-400 whitespace-nowrap">
                          {rec.generatedDate}
                        </td>
                        <td className="py-3 px-4 text-right">
                          <div className="flex items-center justify-end gap-1.5">
                            <button
                              onClick={() => setSelectedReceivedReport(rec)}
                              className="px-2 py-1 rounded bg-navy-50 dark:bg-navy-800 text-navy-800 dark:text-amber-400 hover:bg-navy-100 text-xs font-semibold inline-flex items-center gap-1"
                            >
                              <Eye size={12} /> View
                            </button>
                            <button
                              onClick={() => downloadCSV({ title: rec.title || rec.reportType, rows: rec.rows })}
                              className="px-2 py-1 rounded border border-gray-200 dark:border-navy-700 text-gray-700 dark:text-gray-300 hover:bg-gray-100 text-xs font-medium inline-flex items-center gap-1"
                            >
                              <Download size={12} /> CSV
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>

            {!loadingReceived && filteredReceivedReports.length === 0 && (
              <EmptyState
                title="No officer reports received"
                description="Officer field submissions sent via 'Send to Super Admin' will appear here."
              />
            )}
          </Card>

          {/* Modal for viewing received officer report details */}
          <Modal
            open={!!selectedReceivedReport}
            onClose={() => setSelectedReceivedReport(null)}
            title={selectedReceivedReport?.title || `${selectedReceivedReport?.reportType || "Officer"} Dossier`}
          >
            {selectedReceivedReport && (
              <div className="space-y-4 text-xs">
                <div className="p-3 bg-gray-50 dark:bg-navy-950 rounded-md border border-gray-200 dark:border-navy-800 grid grid-cols-2 gap-2">
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 text-[11px]">Submitted By:</span>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {selectedReceivedReport.officerName} ({selectedReceivedReport.officerEmail})
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 text-[11px]">Jurisdiction:</span>
                    <p className="font-bold text-gray-900 dark:text-gray-100">
                      {selectedReceivedReport.state} · {selectedReceivedReport.district}
                    </p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 text-[11px]">Submission Date:</span>
                    <p className="font-medium text-gray-700 dark:text-gray-300">{selectedReceivedReport.generatedDate}</p>
                  </div>
                  <div>
                    <span className="text-gray-500 dark:text-gray-400 text-[11px]">Report Type:</span>
                    <p className="font-medium text-gray-700 dark:text-gray-300">{selectedReceivedReport.reportType}</p>
                  </div>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {selectedReceivedReport.summary.map((s, idx) => (
                    <div key={idx} className="p-2.5 rounded bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800">
                      <p className="text-[10px] text-gray-500 uppercase">{s.label}</p>
                      <p className="text-sm font-bold text-gray-900 dark:text-gray-100 mt-0.5">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Row Items */}
                <div className="border border-gray-200 dark:border-navy-800 rounded-md overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="bg-gray-50 dark:bg-navy-950 text-left text-gray-500 border-b border-gray-200 dark:border-navy-800">
                        <th className="p-2 font-semibold">Project Identifier</th>
                        <th className="p-2 font-semibold">Audit Finding / Risk</th>
                        <th className="p-2 font-semibold text-right">Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
                      {selectedReceivedReport.rows.map((r, i) => (
                        <tr key={i}>
                          <td className="p-2 font-medium text-gray-800 dark:text-gray-200">{r.project}</td>
                          <td className="p-2 text-gray-600 dark:text-gray-400">{r.risk}</td>
                          <td className="p-2 text-right font-semibold text-gray-900 dark:text-gray-100">{r.amount}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="flex justify-end gap-2 pt-2 border-t border-gray-100 dark:border-navy-800">
                  <Button variant="outline" size="sm" onClick={() => downloadCSV({ title: selectedReceivedReport.title || selectedReceivedReport.reportType, rows: selectedReceivedReport.rows })}>
                    <Download size={13} /> Export CSV
                  </Button>
                  <Button size="sm" onClick={() => setSelectedReceivedReport(null)}>
                    Close
                  </Button>
                </div>
              </div>
            )}
          </Modal>
        </div>
      )}

      {/* ===================== TAB 2: GENERATE REPORT ===================== */}
      {(!isSuperAdmin || activeTab === "generate") && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 animate-fade-in">
          {/* Report Configuration Card */}
          <Card className="lg:col-span-1 h-fit">
            <div className="pb-3 border-b border-gray-100 dark:border-navy-800 mb-3">
              <h2 className="font-bold text-sm text-gray-900 dark:text-gray-100 uppercase tracking-wide">
                Report Configuration · विन्यास
              </h2>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-0.5">
                Select audit parameters and statutory filters
              </p>
            </div>

            <div className="space-y-3.5 text-xs">
              <div>
                <p className="text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1.5">
                  Report Type / प्रकार
                </p>
                <div className="grid grid-cols-1 gap-1">
                  {REPORT_TYPES.map((t) => (
                    <button
                      key={t}
                      onClick={() => setType(t)}
                      className={clsx(
                        "text-left text-xs px-3 py-2 rounded border transition-colors flex items-center justify-between",
                        type === t
                          ? "border-[#0b2545] dark:border-amber-400 bg-navy-50 dark:bg-navy-800 text-[#0b2545] dark:text-amber-400 font-bold"
                          : "border-gray-200 dark:border-navy-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-800/50"
                      )}
                    >
                      <span>{t}</span>
                      {type === t && <CheckCircle2 size={13} />}
                    </button>
                  ))}
                </div>
              </div>

              {/* PROJECT SELECTOR (Required for Project-wise or optional drilldown) */}
              {type === "Project-wise" && (
                <div className="p-2.5 rounded-md bg-amber-50/70 dark:bg-navy-950 border border-amber-200 dark:border-navy-700 space-y-1">
                  <label className="block text-xs font-bold text-amber-900 dark:text-amber-400">
                    Select Specific Project *
                  </label>
                  <select
                    value={selectedProjectId}
                    onChange={(e) => setSelectedProjectId(e.target.value)}
                    className="w-full rounded border border-gray-300 dark:border-navy-700 bg-white dark:bg-navy-900 px-2.5 py-1.5 text-xs text-gray-900 dark:text-gray-100 outline-none focus:border-[#0b2545] dark:focus:border-amber-400"
                  >
                    <option value="">-- Choose Project for Audit Dossier --</option>
                    {availableProjectsForSelection.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.id} — {p.name} ({p.district})
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {/* State Selection */}
              {isSuperAdmin ? (
                <Select
                  label="State Scope"
                  placeholder="All States"
                  options={["", ...Object.keys(DISTRICTS_BY_STATE).sort()].map((s) => ({
                    value: s,
                    label: s || "All India",
                  }))}
                  value={state}
                  onChange={(e) => {
                    setState(e.target.value);
                    setDistrict("");
                  }}
                />
              ) : (
                <div>
                  <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-1">
                    Jurisdiction (State)
                  </label>
                  <div className="px-3 py-2 rounded border border-gray-200 dark:border-navy-700 bg-gray-100 dark:bg-navy-950 text-xs font-semibold text-gray-800 dark:text-gray-200">
                    {user?.assignedState || "Assigned State"} (Locked)
                  </div>
                </div>
              )}

              {/* District Selection */}
              <Select
                label="District Filter"
                placeholder="All Districts"
                options={[
                  "",
                  ...(state && DISTRICTS_BY_STATE[state] ? DISTRICTS_BY_STATE[state] : []),
                ].map((d) => ({ value: d, label: d || "All Districts" }))}
                value={district}
                onChange={(e) => setDistrict(e.target.value)}
                disabled={!state}
              />

              {/* Risk Level Filter */}
              <Select
                label="Risk Level"
                placeholder="All Risk Levels"
                options={["", "Low", "Medium", "High", "Critical"].map((r) => ({
                  value: r,
                  label: r || "All Risk Levels",
                }))}
                value={riskLevel}
                onChange={(e) => setRiskLevel(e.target.value)}
              />

              <div className="grid grid-cols-2 gap-2 pt-1">
                <Input label="From Date" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
                <Input label="To Date" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
              </div>

              <Button
                className="w-full mt-2"
                icon={<FileText size={15} />}
                loading={loading}
                onClick={handleGenerate}
              >
                Generate Report
              </Button>
            </div>
          </Card>

          {/* Report Preview Panel */}
          <div className="lg:col-span-2">
            {loading && (
              <Card>
                <Skeleton className="h-6 w-1/3 mb-4" />
                <Skeleton className="h-28 w-full mb-3" />
                <Skeleton className="h-44 w-full" />
              </Card>
            )}

            {!loading && !report && (
              <Card className="h-full flex flex-col items-center justify-center text-center py-20">
                <Eye size={32} className="text-gray-300 dark:text-gray-600 mb-3" />
                <p className="font-bold text-sm text-gray-700 dark:text-gray-300">No report generated yet</p>
                <p className="text-xs text-gray-400 mt-1 max-w-sm">
                  Choose a report type and scope from the left panel and click "Generate Report" to produce the official dossier.
                </p>
              </Card>
            )}

            {!loading && report && (
              <Card className="animate-fade-in space-y-4">
                <div className="flex items-start justify-between flex-wrap gap-3 pb-3 border-b border-gray-100 dark:border-navy-800">
                  <div>
                    <h3 className="font-bold text-base text-gray-900 dark:text-gray-100">{report.title}</h3>
                    <p className="text-[11px] text-gray-400 mt-0.5 flex items-center gap-1">
                      <Calendar size={11} /> Generated {report.generatedAt} · MoSPI Compliance Protocol
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-wrap">
                    {/* SECTION 2G: Officer "Send to Super Admin" button */}
                    {!isSuperAdmin && (
                      <Button
                        size="sm"
                        onClick={handleSendToSuperAdmin}
                        loading={sendingToAdmin}
                        icon={<Send size={13} />}
                      >
                        Send to Super Admin
                      </Button>
                    )}
                    <Button variant="outline" size="sm" icon={<Download size={13} />} onClick={() => downloadCSV()}>
                      Export CSV
                    </Button>
                  </div>
                </div>

                {/* Summary Metrics */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2.5">
                  {report.summary.map((s, idx) => (
                    <div
                      key={idx}
                      className="bg-gray-50 dark:bg-navy-950 rounded p-2.5 border border-gray-100 dark:border-navy-800"
                    >
                      <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">{s.label}</p>
                      <p className="text-xs font-bold text-gray-900 dark:text-gray-100 mt-0.5 truncate">{s.value}</p>
                    </div>
                  ))}
                </div>

                {/* Data Table */}
                <div className="border border-gray-100 dark:border-navy-800 rounded overflow-hidden">
                  <table className="w-full text-xs">
                    <thead>
                      <tr className="text-left text-gray-500 dark:text-gray-400 uppercase tracking-wider bg-gray-50 dark:bg-navy-950 border-b border-gray-100 dark:border-navy-800">
                        <th className="py-2.5 px-3 font-semibold">Project</th>
                        <th className="py-2.5 px-3 font-semibold">Risk Finding</th>
                        <th className="py-2.5 px-3 font-semibold text-right">Sanctioned Value</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100 dark:divide-navy-800">
                      {report.rows.map((r, i) => (
                        <tr key={i} className="hover:bg-gray-50 dark:hover:bg-navy-800/40 transition-colors">
                          <td className="py-2.5 px-3 text-gray-800 dark:text-gray-200 font-medium">{r.project}</td>
                          <td className="py-2.5 px-3 text-gray-600 dark:text-gray-400">{r.risk}</td>
                          <td className="py-2.5 px-3 text-gray-900 dark:text-gray-100 text-right font-semibold">
                            {r.amount}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </Card>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
