// ============================================================================
// BACKEND API SERVICE LAYER
// ----------------------------------------------------------------------------
// All authoritative actions use the FastAPI backend.
// Demo-only constants remain only where a screen has no server-side equivalent.
// Mutations never report success unless the backend confirms persistence.
// The function signatures and return shapes are designed to stay stable,
// so pages that call these functions should NOT need to change.
// ============================================================================

import type {
  Project,
  RiskAlert,
  AlertType,
  CitizenReport,
  DashboardStats,
  StateRiskData,
  NotificationItem,
  OfficerAccount,
  AuditLogEntry,
} from "../types";

export const BACKEND_BASE_URL = (import.meta as any).env?.VITE_BACKEND_URL || ((import.meta as any).env?.DEV ? "http://localhost:8000" : window.location.origin);

export async function getAuthToken(): Promise<string> {
  return localStorage.getItem("mplads_token") || localStorage.getItem("mplads_officer_jwt_token") || "";
}

export async function getAuthHeaders(): Promise<HeadersInit> {
  const headers: Record<string, string> = {
    "Bypass-Tunnel-Reminder": "true",
  };
  const token = await getAuthToken();
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  return headers;
}

async function fetchWithTimeout(url: string, options: RequestInit = {}, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    clearTimeout(timer);
    return response;
  } catch (err) {
    clearTimeout(timer);
    throw err;
  }
}

export function mapBackendProjectToFrontend(r: any, idx = 0): Project {
  const parsedSanctioned = Number(r.sanction_amount);
  const sanctioned = Number.isFinite(parsedSanctioned) ? parsedSanctioned : 0;
  const parsedDisbursed = Number(r.amount_disbursed_completed ?? r.total_fund_disbursed);
  const disbursed = Number.isFinite(parsedDisbursed) ? parsedDisbursed : 0;
  const riskScore = Math.round(r.risk_score != null ? Number(r.risk_score) : 0);
  const costDeviationScore = Math.round(r.cost_risk_score != null ? Number(r.cost_risk_score) : 0);
  const nlpSimilarity = Math.round(r.nlp_similarity_score != null ? Number(r.nlp_similarity_score) : 0);
  const satScore = r.satellite_risk_score != null ? Math.round(Number(r.satellite_risk_score)) : 0;
  const citizenCount = typeof r.citizen_report_count === "number" ? r.citizen_report_count : 0;
  const costZ = r.cost_zscore != null ? Number(r.cost_zscore) : undefined;
  const parsedPeerCost = Number(r.peer_average_cost);
  const peerAverageCost = Number.isFinite(parsedPeerCost) ? parsedPeerCost : 0;
  const baseRisk = 0.5 * costDeviationScore + 0.5 * nlpSimilarity;
  const beforeFeedback = Number(r.risk_score_before_feedback ?? r.risk_score);
  const citizenContribution = Number.isFinite(beforeFeedback) ? Math.max(0, Math.round(beforeFeedback - baseRisk)) : 0;
  const completed = String(r.work_status || "").toLowerCase().includes("complete");
  const delayed = String(r.work_status || "").toLowerCase().includes("delay");
  const year = Number.parseInt(String(r.sanction_date || "").slice(0, 4), 10);

  return {
    id: r.work_id || `W-${idx}`,
    name: r.work_description || r.work_name || "Description unavailable",
    state: r.state || "Unknown",
    district: r.district || r.constituency || "Unknown",
    constituency: r.constituency || "",
    category: (r.work_category as any) || "Public Infrastructure",
    workType: r.work_category || "Not reported",
    implementingAgency: r.ida || "Not reported",
    sanctionDate: r.sanction_date || "",
    expectedCompletion: r.completion_date || "",
    status: (completed ? "Completed" : delayed ? "Delayed" : "In Progress") as any,
    sanctionedAmount: sanctioned,
    releasedAmount: disbursed,
    expenditure: disbursed,
    physicalProgress: completed ? 100 : 0,
    expectedProgress: 0,
    riskScore: riskScore,
    riskLevel: riskScore >= 80 ? "Critical" : riskScore >= 60 ? "High" : riskScore >= 35 ? "Medium" : "Low",
    year: Number.isFinite(year) ? year : 0,
    latitude: typeof r.resolved_lat === "number" ? r.resolved_lat : (typeof r.latitude === "number" ? r.latitude : 0),
    longitude: typeof r.resolved_lng === "number" ? r.resolved_lng : (typeof r.longitude === "number" ? r.longitude : 0),
    riskFactors: {
      costAnomaly: r.is_cost_outlier ? "High" : "Low",
      duplicateProbability: nlpSimilarity > 70 ? "High" : "Low",
      delayRisk: delayed ? "High" : "Low",
      paymentAnomaly: String(r.latest_payment_status || "").toLowerCase().includes("pending") ? "Review" : "Low",
      satelliteVerification: r.satellite_status && r.satellite_status !== "no_imagery" ? "Review" : "Low",
      citizenSignal: citizenCount > 0 ? "High" : "Low",
    },
    shapFactors: [
      { label: "Cost Deviation", value: Math.round(costDeviationScore * 0.5) },
      { label: "Duplicate Similarity", value: Math.round(nlpSimilarity * 0.5) },
      { label: "Satellite Verification", value: satScore },
      { label: "Citizen Evidence", value: citizenContribution },
    ],
    peerAverageCost,
    similarProjectId: r.similar_project,
    similarityScore: nlpSimilarity,
    similarState: r.similar_state,
    costZScore: costZ,
    satelliteStatus: r.satellite_status,
    imageryStatus: r.imagery_status,
    imagerySource: r.imagery_source,
    locationPrecision: r.location_precision || r.coord_precision,
    localityName: r.locality_name,
    satelliteRiskScore: r.satellite_risk_score,
    citizenReportCount: citizenCount,
    feedbackStatus: r.feedback_status,
    flagReason: costZ
      ? `Cost outlier (Z-Score +${costZ.toFixed(2)}) against peer works`
      : nlpSimilarity
      ? `Semantic overlap score ${nlpSimilarity}% detected with ${r.similar_project || "adjacent work"}`
      : `Flagged for supervisory review based on multi-signal risk model`,
    aiExplanation: r.explanation,
    mpName: r.mp_name,
  };
}

// ---------------------------------------------------------------------------
export async function getDemoShowcase(state?: string, limit = 4): Promise<Project[]> {
  const params = new URLSearchParams({ limit: String(limit) });
  if (state && state !== "All" && state !== "All India") params.set("state", state);
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/demo-showcase?${params.toString()}`, {}, 12000);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "Demo-ready projects are unavailable.");
  const records = Array.isArray(body.items) ? body.items : [];
  return records.map((row: any, index: number) => mapBackendProjectToFrontend(row, index));
}

// Dashboard
// ---------------------------------------------------------------------------
export async function getDashboardStats(state?: string): Promise<DashboardStats> {
  const query = state ? `?state=${encodeURIComponent(state)}` : "";
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/overview${query}`, {}, 12000);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Dashboard summary is unavailable.");
  return {
    totalProjects: data.total_works,
    totalProjectsTrend: 0,
    highRiskProjects: data.high_risk_projects,
    highRiskTrend: 0,
    activeAlerts: data.high_risk_projects,
    activeAlertsTrend: 0,
    fundUtilization: data.fund_utilization,
    fundUtilizationTrend: 0,
    delayedProjects: data.delayed_projects,
    delayedTrend: 0,
    lastUpdated: new Date().toISOString(),
    totalProjectsScanned: data.total_works,
    highRiskFlaggedCount: data.high_risk_projects,
    citizenReportsCount: data.citizen_reports,
    avgRiskScore: data.average_risk_score,
    totalDisbursed: data.total_disbursed,
    riskDistribution: data.risk_distribution,
  };
}

async function getOverviewData(): Promise<any> {
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/overview`, {}, 12000);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Overview is unavailable.");
  return data;
}

export async function getRiskDistribution() {
  const data = await getOverviewData();
  return [
    { name: "Low Risk", value: data.risk_distribution.low, color: "#16a34a" },
    { name: "Medium Risk", value: data.risk_distribution.medium, color: "#d97706" },
    { name: "High Risk", value: data.risk_distribution.high, color: "#ea580c" },
    { name: "Critical Risk", value: data.risk_distribution.critical, color: "#dc2626" },
  ];
}

export async function getFundUtilizationTrend(_period: "monthly" | "quarterly" | "yearly" = "monthly") {
  const data = await getOverviewData();
  return [{ label: "Current dataset", utilization: data.fund_utilization }];
}

export async function getProjectStatusBreakdown() {
  const data = await getOverviewData();
  return [
    { name: "Completed", value: data.completed_projects },
    { name: "Delayed", value: data.delayed_projects },
    { name: "Other / not reported", value: Math.max(0, data.total_works - data.completed_projects - data.delayed_projects) },
  ];
}

export async function getAIInsights(state?: string): Promise<{ id: string; text: string }[]> {
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/overview${state ? `?state=${encodeURIComponent(state)}` : ""}`, {}, 12000);
  const data = await response.json();
  return [
    { id: "risk", text: `${data.high_risk_projects.toLocaleString("en-IN")} projects currently meet the high-risk review threshold.` },
    { id: "reports", text: `${data.citizen_reports.toLocaleString("en-IN")} persisted citizen reports are linked to the registry.` },
  ];
}

export async function getNotifications(): Promise<NotificationItem[]> {
  const reports = await getCitizenReports(5);
  return reports.map((report) => ({ id: report.id, title: `Citizen report received — ${report.projectId}`,
    time: report.submittedDate, type: "info" as const, read: false }));
}

// ---------------------------------------------------------------------------
// Projects
// ---------------------------------------------------------------------------
export interface ProjectFilters {
  search?: string;
  state?: string;
  district?: string;
  category?: string;
  status?: string;
  riskLevel?: string;
  year?: string;
  page?: number;
  pageSize?: number;
  sortBy?: keyof Project;
  sortDir?: "asc" | "desc";
}

export async function getProjects(filters: ProjectFilters = {}): Promise<{ data: Project[]; total: number }> {
  // Search the live MPLADS registry when the query is specific enough.
  if (filters.search && filters.search.trim().length >= 2) {
    try {
      const page = filters.page ?? 1;
      const pageSize = filters.pageSize ?? 10;
      const params = new URLSearchParams({
        q: filters.search.trim(),
        page: String(page),
        page_size: String(pageSize),
      });
      const res = await fetchWithTimeout(`${BACKEND_BASE_URL}/search-projects?${params.toString()}`);
      if (res.ok) {
        const body = await res.json();
        if (body && Array.isArray(body.results)) {
          const mapped = body.results.map((r: any, idx: number) => mapBackendProjectToFrontend(r, idx));
          return { data: mapped, total: body.total || mapped.length };
        }
      }
    } catch (err) {
      console.warn("Live project search error:", err);
    }
  }

  return getFlaggedProjects(filters);
}

export async function getFlaggedProjects(filters: ProjectFilters = {}): Promise<{ data: Project[]; total: number }> {
  const params = new URLSearchParams({
    include_meta: "true",
    page: String(filters.page || 1),
    page_size: String(filters.pageSize || 20),
  });
  if (filters.state && filters.state !== "All") params.set("state", filters.state);
  if (filters.category && filters.category !== "All") params.set("work_category", filters.category);
  if (filters.district && filters.district !== "All") params.set("district", filters.district);
  if (filters.search) params.set("search", filters.search);
  if (filters.riskLevel && filters.riskLevel !== "All") params.set("risk_level", filters.riskLevel);
  if (filters.status && filters.status !== "All") params.set("work_status", filters.status);
  if (filters.year) params.set("year", filters.year);

  const authHeaders = await getAuthHeaders();
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/flagged-projects?${params.toString()}`, { headers: authHeaders }, 12000);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "Flagged projects are unavailable.");
  const records = Array.isArray(body.items) ? body.items : Array.isArray(body) ? body : [];
  let mapped = records.map((row: any, index: number) => mapBackendProjectToFrontend(row, index));
  if (filters.sortBy) {
    const direction = filters.sortDir === "asc" ? 1 : -1;
    mapped = mapped.sort((left: Project, right: Project) => {
      const a = left[filters.sortBy as keyof Project];
      const b = right[filters.sortBy as keyof Project];
      if (typeof a === "number" && typeof b === "number") return (a - b) * direction;
      return String(a).localeCompare(String(b)) * direction;
    });
  }
  return { data: mapped, total: Number(body.total ?? mapped.length) };
}

export function getSatelliteImageUrl(workId: string): string {
  return `${BACKEND_BASE_URL}/project-satellite-image?work_id=${encodeURIComponent(workId.trim())}`;
}

export function getAuditBriefPdfUrl(workId: string): string {
  return `${BACKEND_BASE_URL}/audit-brief?work_id=${encodeURIComponent(workId.trim())}`;
}

export async function saveChecklist(workId: string, state: any): Promise<any> {
  const authHeaders = await getAuthHeaders();
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/checklist`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ work_id: workId, ...state }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Checklist could not be saved.");
  return data;
}

export async function getChecklist(workId: string): Promise<any> {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetchWithTimeout(`${BACKEND_BASE_URL}/checklist?work_id=${encodeURIComponent(workId.trim())}`, {
      headers: authHeaders,
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn("Failed to get checklist from backend:", err);
  }
  return null;
}

export async function askCitizenChatbot(query: string, history: any[] = []): Promise<string> {
  try {
    const res = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/citizen-chatbot`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ query, history }),
    });
    if (res.ok) {
      const data = await res.json();
      return data.reply || data.response || data.message || "Thank you for contacting the MPLADS portal.";
    }
  } catch (err) {
    console.warn("Citizen chatbot backend error:", err);
  }
  return "The automated assistant is currently synchronizing with the central registry. Please refer to the citizen information sections above.";
}

export async function getReportVerification(reportId: string): Promise<any> {
  try {
    const res = await fetchWithTimeout(`${BACKEND_BASE_URL}/citizen-report-verification/${encodeURIComponent(reportId)}`);
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn("Failed to verify report:", err);
  }
  return null;
}

export async function getProjectById(id: string): Promise<Project | undefined> {
  const cleanId = decodeURIComponent(id).trim();
  const authHeaders = await getAuthHeaders();
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/project?work_id=${encodeURIComponent(cleanId)}`, { headers: authHeaders }, 12000);
  if (response.status === 404) return undefined;
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Project service is unavailable.");
  return data.project ? mapBackendProjectToFrontend(data.project, 0) : undefined;
}

export async function submitProjectFeedback(
  workId: string,
  verdict: "confirmed_issue" | "false_positive",
  officerNotes = "",
  officerId = ""
): Promise<{ success: boolean; newRiskScore?: number; message: string }> {
  const authHeaders = await getAuthHeaders();
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/feedback`, {
    method: "POST",
    headers: { ...authHeaders, "Content-Type": "application/json" },
    body: JSON.stringify({ work_id: workId, verdict, officer_notes: officerNotes, officer_id: officerId }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Feedback could not be saved.");
  return { success: true, newRiskScore: data.new_risk_score, message: data.message || "Feedback recorded." };
}

export async function getCitizenReportsForProject(workId: string): Promise<CitizenReport[]> {
  try {
    const res = await fetchWithTimeout(`${BACKEND_BASE_URL}/citizen-reports?work_id=${encodeURIComponent(workId)}`);
    if (res.ok) {
      const records = await res.json();
      if (Array.isArray(records) && records.length > 0) {
        return records.map((r: any, i: number) => ({
          id: r.report_id || `CR-${i + 1}`,
          projectId: r.work_id || workId,
          projectName: `Work ${workId}`,
          location: r.captured_lat && r.captured_lng ? `${r.captured_lat}, ${r.captured_lng}` : "On-site GPS",
          issueType: (r.category || "Poor quality") as any,
          description: r.description || "Citizen field observation reported.",
          submittedDate: r.timestamp || r.captured_timestamp || new Date().toISOString().split("T")[0],
          status: "Received",
          hasPhoto: Boolean(r.photo_saved || r.photo_url || r.photo_hash),
        }));
      }
    }
  } catch {}

  return [];
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------
export interface AlertFilters {
  status?: string;
  riskLevel?: string;
  type?: string;
  search?: string;
  state?: string;
  district?: string;
}

export async function getRiskAlerts(filters: AlertFilters = {}): Promise<RiskAlert[]> {
  const params = new URLSearchParams({ limit: "150" });
  if (filters.status && filters.status !== "All") params.set("status", filters.status.toUpperCase().replace(" ", "_"));
  if (filters.state && filters.state !== "All") params.set("state", filters.state);
  if (filters.district && filters.district !== "All") params.set("district", filters.district);
  const headers = await getAuthHeaders();
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/compliance/alerts?${params}`, { headers }, 12000);
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(body.detail || "Alerts are unavailable.");
  let results: RiskAlert[] = (body.results || []).map((row: any) => {
    const alertType = String(row.alert_type || "");
    const type: AlertType = alertType.includes("COST") ? "Cost Anomaly" : alertType.includes("DUPLICATE") ? "Duplicate Work" : alertType.includes("DEADLINE") || alertType.includes("INSPECTION") ? "Delay" : alertType.includes("CITIZEN") ? "Citizen Signal" : "Payment Anomaly";
    const riskScore = Number(row.risk_score ?? 0);
    return { id: row.alert_id, projectId: row.project_id, projectName: row.project_name, location: `${row.district}, ${row.state}`,
      riskScore, riskLevel: row.severity === "CRITICAL" ? "Critical" : row.severity === "HIGH" ? "High" : row.severity === "MEDIUM" ? "Medium" : "Low",
      type, description: row.reason, detectedDate: row.date_generated,
      status: row.status === "RESOLVED" ? "Resolved" : row.status === "ACKNOWLEDGED" ? "Under Review" : "Open",
      assignedOfficer: row.assigned_authority, recommendedAction: row.assigned_authority, evidence: [row.reason] } as RiskAlert;
  });
  if (filters.riskLevel && filters.riskLevel !== "All") results = results.filter((item) => item.riskLevel === filters.riskLevel);
  if (filters.type && filters.type !== "All") results = results.filter((item) => item.type === filters.type);
  if (filters.search) {
    const query = filters.search.toLowerCase();
    results = results.filter((item) => `${item.id} ${item.projectId} ${item.projectName}`.toLowerCase().includes(query));
  }
  return results;
}

export async function updateAlertStatus(alertId: string, status: RiskAlert["status"]): Promise<RiskAlert | undefined> {
  const headers = await getAuthHeaders();
  const action = status === "Resolved" ? "resolve" : "acknowledge";
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/compliance/action`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify({ alert_id: alertId, project_id: "", action, officer_id: "authenticated-user" }),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Alert status could not be updated.");
  return undefined;
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
export async function getAnalytics() {
  const overview = await getOverviewData();
  const states = await getRiskMapData();
  return { avgProjectCostTrend: [], costDeviationByCategory: [], delayDistribution: [], riskTrend: [],
    stateWise: states.map((state) => ({ name: state.state, value: state.highRisk + state.critical })),
    insights: [`${overview.high_risk_projects} projects meet the high-risk threshold in the current dataset.`] };
}

// ---------------------------------------------------------------------------
// Risk Map
// ---------------------------------------------------------------------------
export async function getRiskMapData(): Promise<StateRiskData[]> {
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/state-risk`, {}, 12000);
  const data = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error("State risk data is unavailable.");
  return data.map((row: any) => ({ state: row.state, totalProjects: row.total_projects, highRisk: row.high_risk, critical: row.critical, alerts: row.alerts, fundUtilization: row.fund_utilization, riskLevel: row.risk_level }));
}

// ---------------------------------------------------------------------------
// Citizen Reports
// ---------------------------------------------------------------------------
export async function getCitizenReports(limit?: number): Promise<CitizenReport[]> {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetchWithTimeout(`${BACKEND_BASE_URL}/citizen-reports`, { headers: authHeaders });
    if (res.ok) {
      const records = await res.json();
      if (Array.isArray(records) && records.length > 0) {
        const mapped: CitizenReport[] = records.map((r: any, i: number) => ({
          id: r.report_id || `CR-${i + 1}`,
          projectId: r.work_id || "WS/MP/GEN",
          projectName: `Work ${r.work_id || ""}`,
          location: r.captured_lat && r.captured_lng ? `${r.captured_lat}, ${r.captured_lng}` : "On-site GPS",
          issueType: (r.category || "Poor quality") as any,
          description: r.description || "Citizen field observation reported.",
          submittedDate: r.timestamp || r.captured_timestamp || new Date().toISOString().split("T")[0],
          status: "Received",
          hasPhoto: Boolean(r.photo_saved || r.photo_url || r.photo_hash),
        }));
        mapped.sort((a, b) => (a.submittedDate < b.submittedDate ? 1 : -1));
        return limit ? mapped.slice(0, limit) : mapped;
      }
    }
  } catch (err) {
    console.warn("Could not fetch live citizen reports:", err);
  }
  return [];
}

export interface CitizenReportSubmission {
  projectId: string;
  location: string;
  issueType: string;
  description: string;
  hasPhoto?: boolean;
  photoFile?: File | null;
}

export async function submitCitizenReport(submission: CitizenReportSubmission): Promise<{ id: string }> {
  if (!submission.photoFile) {
    throw new Error("A real project-site photo is required.");
  }
  const formData = new FormData();
  formData.append("work_id", submission.projectId.trim());
  formData.append("description", submission.description.trim());
  if (submission.issueType) formData.append("category", submission.issueType);
  if (submission.location && submission.location.includes(",")) {
    const parts = submission.location.split(",").map((part) => Number(part.trim()));
    if (Number.isFinite(parts[0]) && Number.isFinite(parts[1])) {
      formData.append("captured_lat", String(parts[0]));
      formData.append("captured_lng", String(parts[1]));
    }
  }
  formData.append("photo", submission.photoFile);
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/citizen-report`, { method: "POST", body: formData }, 20000);
  const data = await response.json().catch(() => ({}));
  if (!response.ok || !data.report_id) {
    throw new Error(data.detail || "The report could not be saved. Please retry.");
  }
  return { id: data.report_id };
}

// ---------------------------------------------------------------------------
// Reports
// ---------------------------------------------------------------------------
export interface ReportRequest {
  type: string;
  dateFrom?: string;
  dateTo?: string;
  state?: string;
  district?: string;
  riskLevel?: string;
  projectId?: string;
}

export interface SubmittedOfficerReport {
  id: string;
  title?: string;
  officerName: string;
  officerEmail: string;
  state: string;
  district: string;
  reportType: string;
  projectName?: string;
  generatedDate: string;
  summary: { label: string; value: string }[];
  rows: { project: string; risk: string; amount: string }[];
}

export async function getSubmittedOfficerReports(): Promise<SubmittedOfficerReport[]> {
  const headers = await getAuthHeaders();
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/officer-reports`, { headers });
  const data = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error("Submitted reports are unavailable.");
  return data.map((row: any) => ({ id: row.id, officerName: row.officer_name, officerEmail: row.officer_email,
    state: row.state, district: row.district, reportType: row.report_type, projectName: row.project_name,
    generatedDate: row.generated_date, summary: row.summary || [], rows: row.rows || [] }));
}

export async function submitReportToAdmin(
  reportData: Omit<SubmittedOfficerReport, "id" | "generatedDate">
): Promise<SubmittedOfficerReport> {
  const headers = await getAuthHeaders();
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/officer-reports`, {
    method: "POST", headers: { ...headers, "Content-Type": "application/json" }, body: JSON.stringify(reportData),
  });
  const row = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(row.detail || "Report could not be submitted.");
  return { id: row.id, officerName: row.officer_name, officerEmail: row.officer_email, state: row.state,
    district: row.district, reportType: row.report_type, projectName: row.project_name,
    generatedDate: row.generated_date, summary: row.summary || [], rows: row.rows || [] };
}

export async function generateReport(request: ReportRequest): Promise<{
  title: string; generatedAt: string; summary: { label: string; value: string }[];
  rows: { project: string; risk: string; amount: string }[];
}> {
  let projects: Project[] = [];
  if (request.projectId) {
    const project = await getProjectById(request.projectId);
    if (project) projects = [project];
  } else {
    const result = await getFlaggedProjects({ state: request.state, district: request.district, riskLevel: request.riskLevel, pageSize: 200 });
    projects = result.data;
  }
  const totalAmount = projects.reduce((sum, project) => sum + project.sanctionedAmount, 0);
  return {
    title: request.projectId ? `Project Audit Report: ${request.projectId}` : request.type || "MPLADS Monitoring Report",
    generatedAt: new Date().toLocaleString("en-IN"),
    summary: [
      { label: "Projects Covered", value: String(projects.length) },
      { label: "High/Critical Risk", value: String(projects.filter((p) => p.riskScore >= 60).length) },
      { label: "Sanctioned Value", value: `₹${(totalAmount / 10000000).toFixed(2)} Cr` },
      { label: "Source", value: "Live MPLADS backend" },
    ],
    rows: projects.map((p) => ({ project: `${p.id} — ${p.name}`, risk: `${p.riskScore}/100 (${p.riskLevel})`, amount: `₹${(p.sanctionedAmount / 100000).toFixed(1)}L` })),
  };
}

// ---------------------------------------------------------------------------
// Super Admin — Officer Management
// ---------------------------------------------------------------------------
export async function getOfficers(): Promise<OfficerAccount[]> {
  const headers = await getAuthHeaders();
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/officers`, { headers });
  const data = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error("Officer directory is unavailable.");
  return data.map((row: any) => ({
    id: row.officer_id, name: row.officer_id, email: `${row.officer_id.toLowerCase()}@mplads.gov.in`,
    title: String(row.role || "officer").replaceAll("_", " "),
    jurisdiction: row.district === "ALL" ? row.state : `${row.district}, ${row.state}`,
    state: row.state, status: row.status, projectsAssigned: row.projects_assigned,
    alertsHandled: row.alerts_handled, lastLogin: "Never",
  }));
}

export async function updateOfficerStatus(
  officerId: string,
  status: OfficerAccount["status"]
): Promise<OfficerAccount | undefined> {
  const headers = await getAuthHeaders();
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/officers/${encodeURIComponent(officerId)}?account_status=${status}`, { method: "PATCH", headers });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "Officer status could not be updated.");
  return (await getOfficers()).find((officer) => officer.id === officerId);
}

export interface NewOfficerInput {
  name: string;
  email: string;
  title: string;
  jurisdiction: string;
  state: string;
}

export async function addOfficer(_input: NewOfficerInput): Promise<OfficerAccount> {
  throw new Error("New login accounts must be provisioned through server configuration.");
}

// ---------------------------------------------------------------------------
// Super Admin — System Overview & Audit Logs
// ---------------------------------------------------------------------------
export async function getSystemOverview(state?: string, district?: string) {
  const params = new URLSearchParams();
  if (state && state !== "All India") params.set("state", state);
  if (district && district !== "All Districts") params.set("district", district);
  const query = params.size ? `?${params.toString()}` : "";
  const headers = await getAuthHeaders();
  const [response, officersResponse] = await Promise.all([
    fetchWithTimeout(`${BACKEND_BASE_URL}/overview${query}`, {}, 12000),
    fetchWithTimeout(`${BACKEND_BASE_URL}/api/officers`, { headers }, 12000),
  ]);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.detail || "System overview is unavailable.");
  const officerData = officersResponse.ok ? await officersResponse.json().catch(() => []) : [];
  const officers = Array.isArray(officerData) ? officerData : [];
  return {
    totalOfficers: officers.length,
    activeOfficers: officers.filter((officer: any) => officer.status === "Active").length,
    totalStates: data.total_states,
    totalProjects: data.total_works, totalAlerts: data.high_risk_projects,
    pendingCitizenReports: data.citizen_reports, systemUptime: "Online",
    totalSanctioned: data.total_sanctioned, totalDisbursed: data.total_disbursed,
    fundUtilization: data.fund_utilization, lastSync: new Date().toISOString(),
    riskDistribution: data.risk_distribution,
  };
}

export async function getAuditLogs(limit?: number): Promise<AuditLogEntry[]> {
  const headers = await getAuthHeaders();
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/api/audit-logs?limit=${limit || 100}`, { headers });
  const data = await response.json().catch(() => ([]));
  if (!response.ok) throw new Error("Audit logs are unavailable.");
  return data.map((row: any) => ({ id: row.id, actor: row.actor, actorRole: row.actor_role,
    action: row.action, target: row.target, timestamp: row.timestamp, ipAddress: row.ip_address || "Recorded server-side" }));
}

// ---------------------------------------------------------------------------
// Global Search
// ---------------------------------------------------------------------------
export async function globalSearch(query: string) {
  if (query.trim().length < 2) return { projects: [], alerts: [] };
  const response = await fetchWithTimeout(`${BACKEND_BASE_URL}/search-projects?q=${encodeURIComponent(query.trim())}&page_size=5`);
  const data = await response.json().catch(() => ({}));
  if (!response.ok) return { projects: [], alerts: [] };
  return { projects: (data.results || []).map((row: any, index: number) => mapBackendProjectToFrontend(row, index)), alerts: [] };
}
