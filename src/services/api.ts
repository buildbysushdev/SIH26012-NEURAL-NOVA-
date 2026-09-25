// ============================================================================
// MOCK API SERVICE LAYER
// ----------------------------------------------------------------------------
// This file simulates a REST API using in-memory mock data and Promises.
// When the real backend is ready, replace the internals of each function
// with actual `fetch`/`axios` calls to the corresponding backend endpoint.
// The function signatures and return shapes are designed to stay stable,
// so pages that call these functions should NOT need to change.
// ============================================================================

import {
  PROJECTS,
  ALERTS,
  CITIZEN_REPORTS,
  STATE_RISK_DATA,
  OFFICERS,
  AUDIT_LOGS,
} from "../data/mockData";
import type {
  Project,
  RiskAlert,
  CitizenReport,
  DashboardStats,
  StateRiskData,
  NotificationItem,
  OfficerAccount,
  AuditLogEntry,
} from "../types";

const NETWORK_DELAY = 350;
export const BACKEND_BASE_URL = (import.meta as any).env?.VITE_BACKEND_URL || "http://localhost:8000";

function delay<T>(data: T, ms = NETWORK_DELAY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

let inFlightTokenPromise: Promise<string> | null = null;

export async function getAuthToken(): Promise<string> {
  const stored = localStorage.getItem("mplads_token") || localStorage.getItem("mplads_officer_jwt_token");
  if (stored) return stored;
  if (inFlightTokenPromise) return inFlightTokenPromise;
  inFlightTokenPromise = (async () => {
    try {
      const res = await fetch(`${BACKEND_BASE_URL}/auth/token`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          officer_id: "AUDITOR-VIGILANCE-01",
          password: "officer@SIH2026",
        }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.access_token) {
          localStorage.setItem("mplads_token", data.access_token);
          return data.access_token;
        }
      }
    } catch (err) {
      console.warn("Could not auto-fetch auditor token:", err);
    } finally {
      inFlightTokenPromise = null;
    }
    return "";
  })();
  return inFlightTokenPromise;
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
  const sanctioned = typeof r.sanction_amount === "number" ? r.sanction_amount : parseFloat(r.sanction_amount) || 2500000;
  const disbursed = r.amount_disbursed_completed || r.total_fund_disbursed || Math.round(sanctioned * 0.85);
  const riskScore = Math.round(r.risk_score != null ? Number(r.risk_score) : 50);
  const costDeviationScore = Math.round(r.cost_risk_score != null ? Number(r.cost_risk_score) : 30);
  const nlpSimilarity = Math.round(r.nlp_similarity_score != null ? Number(r.nlp_similarity_score) : 0);
  const satScore = r.satellite_risk_score != null ? Math.round(Number(r.satellite_risk_score)) : 10;
  const citizenCount = typeof r.citizen_report_count === "number" ? r.citizen_report_count : 0;
  const costZ = r.cost_zscore != null ? Number(r.cost_zscore) : undefined;

  return {
    id: r.work_id || `W-${idx}`,
    name: r.work_description || r.work_name || `MPLADS Work ${r.work_id}`,
    state: r.state || "National",
    district: r.district || r.constituency || "General",
    constituency: r.constituency || "",
    category: (r.work_category as any) || "Public Infrastructure",
    workType: r.work_category || "Development Work",
    implementingAgency: r.ida || "District Authority",
    sanctionDate: r.sanction_date || "2024-01-15",
    expectedCompletion: r.completion_date || "2025-03-31",
    status: (r.feedback_status === "confirmed_issue"
      ? "Under Review"
      : r.feedback_status === "false_positive"
      ? "Completed"
      : r.work_status === "Completed"
      ? "Completed"
      : "In Progress") as any,
    sanctionedAmount: sanctioned,
    releasedAmount: sanctioned,
    expenditure: disbursed,
    physicalProgress: r.work_status === "Completed" ? 100 : 65,
    expectedProgress: 80,
    riskScore: riskScore,
    riskLevel: riskScore >= 80 ? "Critical" : riskScore >= 60 ? "High" : riskScore >= 40 ? "Medium" : "Low",
    year: 2024,
    latitude: typeof r.resolved_lat === "number" ? r.resolved_lat : (typeof r.latitude === "number" ? r.latitude : 20.5937),
    longitude: typeof r.resolved_lng === "number" ? r.resolved_lng : (typeof r.longitude === "number" ? r.longitude : 78.9629),
    riskFactors: {
      costAnomaly: r.is_cost_outlier ? "High" : "Low",
      duplicateProbability: nlpSimilarity > 70 ? "High" : "Low",
      delayRisk: "Medium",
      paymentAnomaly: "Low",
      satelliteVerification: r.satellite_status && r.satellite_status !== "no_imagery" ? "Review" : "Low",
      citizenSignal: citizenCount > 0 ? "High" : "Low",
    },
    shapFactors: [
      { label: "Cost Deviation", value: costDeviationScore },
      { label: "Duplicate Similarity", value: nlpSimilarity },
      { label: "Satellite Verification", value: satScore },
      { label: "Citizen Reports", value: citizenCount * 15 },
    ],
    peerAverageCost: Math.round(sanctioned * 0.75),
    similarProjectId: r.similar_project,
    similarityScore: nlpSimilarity,
    similarState: r.similar_state,
    costZScore: costZ,
    satelliteStatus: r.satellite_status,
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
// Dashboard
// ---------------------------------------------------------------------------
export async function getDashboardStats(): Promise<DashboardStats> {
  const totalSanctioned = PROJECTS.reduce((s, p) => s + p.sanctionedAmount, 0);
  const totalExpenditure = PROJECTS.reduce((s, p) => s + p.expenditure, 0);

  let totalProjectsScanned = 77312;
  let highRiskCount = PROJECTS.filter((p) => p.riskScore >= 70).length;
  let citizenCount = CITIZEN_REPORTS.length;
  const highRiskSubset = PROJECTS.filter((p) => p.riskScore >= 50);
  let avgRisk = Math.round(highRiskSubset.reduce((acc, p) => acc + p.riskScore, 0) / (highRiskSubset.length || 1));

  try {
    const rootRes = await fetchWithTimeout(`${BACKEND_BASE_URL}/`);
    if (rootRes.ok) {
      const data = await rootRes.json();
      if (data.total_projects) totalProjectsScanned = data.total_projects;
    }
  } catch {}

  try {
    const authHeaders = await getAuthHeaders();
    const flaggedRes = await fetchWithTimeout(`${BACKEND_BASE_URL}/flagged-projects?limit=500`, {
      headers: authHeaders,
    });
    if (flaggedRes.ok) {
      const flagged = await flaggedRes.json();
      if (Array.isArray(flagged) && flagged.length > 0) {
        highRiskCount = flagged.filter((p: any) => (p.risk_score || 0) >= 70).length;
        const totalScore = flagged.reduce((acc: number, p: any) => acc + (p.risk_score || 0), 0);
        avgRisk = Math.round(totalScore / flagged.length);
      }
    }
  } catch {}

  try {
    const citizenRes = await fetchWithTimeout(`${BACKEND_BASE_URL}/citizen-reports`);
    if (citizenRes.ok) {
      const reports = await citizenRes.json();
      if (Array.isArray(reports)) citizenCount = reports.length;
    }
  } catch {}

  return {
    totalProjects: totalProjectsScanned,
    totalProjectsTrend: 3.2,
    highRiskProjects: highRiskCount,
    highRiskTrend: 6.1,
    activeAlerts: ALERTS.filter((a) => a.status !== "Resolved").length + 300,
    activeAlertsTrend: -2.4,
    fundUtilization: Math.round((totalExpenditure / totalSanctioned) * 1000) / 10,
    fundUtilizationTrend: 1.8,
    delayedProjects: 126,
    delayedTrend: 4.5,
    lastUpdated: new Date().toISOString(),
    // 4 Primary KPI cards for redesigned dashboard
    totalProjectsScanned,
    highRiskFlaggedCount: highRiskCount,
    citizenReportsCount: citizenCount,
    avgRiskScore: avgRisk,
  };
}

export async function getRiskDistribution() {
  return delay([
    { name: "Low Risk", value: 8420, color: "#16a34a" },
    { name: "Medium Risk", value: 3120, color: "#d97706" },
    { name: "High Risk", value: 918, color: "#ea580c" },
    { name: "Critical Risk", value: 384, color: "#dc2626" },
  ]);
}

export async function getFundUtilizationTrend(period: "monthly" | "quarterly" | "yearly" = "monthly") {
  const monthly = [
    { label: "Apr", utilization: 58 },
    { label: "May", utilization: 61 },
    { label: "Jun", utilization: 64 },
    { label: "Jul", utilization: 66 },
    { label: "Aug", utilization: 69 },
    { label: "Sep", utilization: 71 },
    { label: "Oct", utilization: 73 },
    { label: "Nov", utilization: 74 },
    { label: "Dec", utilization: 76 },
    { label: "Jan", utilization: 78 },
    { label: "Feb", utilization: 81 },
    { label: "Mar", utilization: 74.8 },
  ];
  if (period === "quarterly") {
    return delay([
      { label: "Q1", utilization: 61 },
      { label: "Q2", utilization: 68 },
      { label: "Q3", utilization: 74 },
      { label: "Q4", utilization: 78 },
    ]);
  }
  if (period === "yearly") {
    return delay([
      { label: "2022-23", utilization: 64 },
      { label: "2023-24", utilization: 71 },
      { label: "2024-25", utilization: 74.8 },
    ]);
  }
  return delay(monthly);
}

export async function getProjectStatusBreakdown() {
  const counts = { "Not Started": 0, "In Progress": 0, Completed: 0, Delayed: 0 };
  PROJECTS.forEach((p) => (counts[p.status] += 1));
  const scale = 12842 / PROJECTS.length;
  return delay(
    Object.entries(counts).map(([name, value]) => ({
      name,
      value: Math.round(value * scale),
    }))
  );
}

export async function getAIInsights(): Promise<{ id: string; text: string }[]> {
  return delay([
    {
      id: "insight-1",
      text: "Projects in the Community Infrastructure category are showing a higher-than-usual cost deviation in selected districts.",
    },
    {
      id: "insight-2",
      text: "Duplicate similarity flags have increased 11% month-over-month for Drinking Water works in Maharashtra.",
    },
  ]);
}

export async function getNotifications(): Promise<NotificationItem[]> {
  return delay([
    { id: "n1", title: "New Critical Risk Alert — MPL-10291", time: "12 min ago", type: "critical", read: false },
    { id: "n2", title: "Citizen report received — MPL-9842", time: "48 min ago", type: "info", read: false },
    { id: "n3", title: "Delay risk detected — MPL-8721", time: "2 hr ago", type: "warning", read: false },
    { id: "n4", title: "Satellite verification completed — MPL-10102", time: "5 hr ago", type: "info", read: true },
    { id: "n5", title: "Cost anomaly resolved — MPL-9310", time: "1 day ago", type: "info", read: true },
  ]);
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
  // If there's a search term with at least 2 characters, search the live 77,312 MPLADS database!
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

  let results = [...PROJECTS];

  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.district.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q)
    );
  }
  if (filters.state && filters.state !== "All") results = results.filter((p) => p.state.toLowerCase() === filters.state?.toLowerCase());
  if (filters.district && filters.district !== "All") results = results.filter((p) => p.district.toLowerCase() === filters.district?.toLowerCase());
  if (filters.category && filters.category !== "All") results = results.filter((p) => p.category === filters.category);
  if (filters.status && filters.status !== "All") results = results.filter((p) => p.status === filters.status);
  if (filters.riskLevel && filters.riskLevel !== "All") results = results.filter((p) => p.riskLevel === filters.riskLevel);
  if (filters.year) results = results.filter((p) => String(p.year) === filters.year);

  if (filters.sortBy) {
    const dir = filters.sortDir === "desc" ? -1 : 1;
    results.sort((a, b) => {
      const av = a[filters.sortBy as keyof Project];
      const bv = b[filters.sortBy as keyof Project];
      if (typeof av === "number" && typeof bv === "number") return (av - bv) * dir;
      return String(av).localeCompare(String(bv)) * dir;
    });
  }

  const total = results.length;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 10;
  const start = (page - 1) * pageSize;
  const data = results.slice(start, start + pageSize);

  return delay({ data, total });
}

export async function getFlaggedProjects(filters: ProjectFilters = {}): Promise<{ data: Project[]; total: number }> {
  try {
    const params = new URLSearchParams();
    if (filters.state && filters.state !== "All") params.set("state", filters.state);
    if (filters.category && filters.category !== "All") params.set("work_category", filters.category);
    if (filters.district && filters.district !== "All") params.set("district", filters.district);
    params.set("limit", String(filters.pageSize || 100));

    const authHeaders = await getAuthHeaders();
    const res = await fetchWithTimeout(`${BACKEND_BASE_URL}/flagged-projects?${params.toString()}`, {
      headers: authHeaders,
    });
    if (res.ok) {
      const records = await res.json();
      if (Array.isArray(records) && records.length > 0) {
        const mapped: Project[] = records.map((r: any, idx: number) => mapBackendProjectToFrontend(r, idx));

        let filtered = mapped;
        if (filters.state && filters.state !== "All") {
          filtered = filtered.filter((p) => p.state.toLowerCase() === filters.state?.toLowerCase());
        }
        if (filters.district && filters.district !== "All") {
          filtered = filtered.filter((p) => p.district.toLowerCase() === filters.district?.toLowerCase());
        }
        if (filters.riskLevel && filters.riskLevel !== "All") {
          filtered = filtered.filter((p) => p.riskLevel === filters.riskLevel);
        }
        if (filters.status && filters.status !== "All") {
          filtered = filtered.filter((p) => p.status === filters.status);
        }
        if (filters.category && filters.category !== "All") {
          filtered = filtered.filter((p) => p.category === filters.category);
        }
        if (filters.search) {
          const q = filters.search.toLowerCase();
          filtered = filtered.filter(
            (p) =>
              p.id.toLowerCase().includes(q) ||
              p.name.toLowerCase().includes(q) ||
              p.district.toLowerCase().includes(q) ||
              p.state.toLowerCase().includes(q)
          );
        }
        return { data: filtered, total: filtered.length };
      }
    }
  } catch (err) {
    console.warn("Could not fetch live flagged projects:", err);
  }

  // Fallback to high-risk projects sorted by riskScore descending
  let results = [...PROJECTS].sort((a, b) => b.riskScore - a.riskScore);

  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (p) =>
        p.id.toLowerCase().includes(q) ||
        p.name.toLowerCase().includes(q) ||
        p.district.toLowerCase().includes(q) ||
        p.state.toLowerCase().includes(q)
    );
  }
  if (filters.state && filters.state !== "All") {
    results = results.filter((p) => p.state.toLowerCase() === filters.state?.toLowerCase());
  }
  if (filters.district && filters.district !== "All") {
    results = results.filter((p) => p.district.toLowerCase() === filters.district?.toLowerCase());
  }
  if (filters.category && filters.category !== "All") results = results.filter((p) => p.category === filters.category);
  if (filters.status && filters.status !== "All") results = results.filter((p) => p.status === filters.status);
  if (filters.riskLevel && filters.riskLevel !== "All") results = results.filter((p) => p.riskLevel === filters.riskLevel);

  const total = results.length;
  const page = filters.page ?? 1;
  const pageSize = filters.pageSize ?? 10;
  const start = (page - 1) * pageSize;
  const data = results.slice(start, start + pageSize);

  return delay({ data, total });
}

export function getSatelliteImageUrl(workId: string): string {
  return `${BACKEND_BASE_URL}/project-satellite-image?work_id=${encodeURIComponent(workId.trim())}`;
}

export function getAuditBriefPdfUrl(workId: string): string {
  return `${BACKEND_BASE_URL}/audit-brief?work_id=${encodeURIComponent(workId.trim())}`;
}

export async function saveChecklist(workId: string, state: any): Promise<any> {
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetchWithTimeout(`${BACKEND_BASE_URL}/checklist`, {
      method: "POST",
      headers: { ...authHeaders, "Content-Type": "application/json" },
      body: JSON.stringify({ work_id: workId, ...state }),
    });
    if (res.ok) return await res.json();
  } catch (err) {
    console.warn("Failed to save checklist to backend:", err);
  }
  return { success: true };
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
  // First try backend
  try {
    const authHeaders = await getAuthHeaders();
    const res = await fetchWithTimeout(`${BACKEND_BASE_URL}/project?work_id=${encodeURIComponent(cleanId)}`, {
      headers: authHeaders,
    });
    if (res.ok) {
      const data = await res.json();
      const r = data.project;
      if (r) {
        return mapBackendProjectToFrontend(r, 0);
      }
    }
  } catch (err) {
    console.warn("Could not fetch project from backend:", err);
  }

  // Fallback to local project
  return delay(PROJECTS.find((p) => p.id === cleanId || p.id === id));
}

export async function submitProjectFeedback(
  workId: string,
  verdict: "confirmed_issue" | "false_positive",
  officerNotes = "",
  officerId = "OFF-001"
): Promise<{ success: boolean; newRiskScore?: number; message: string }> {
  // Update local memory
  const localProject = PROJECTS.find((p) => p.id === workId);
  let newScore: number | undefined;
  if (localProject) {
    if (verdict === "false_positive") {
      localProject.feedbackStatus = "false_positive";
      localProject.riskScore = Math.max(0, localProject.riskScore - 25);
      localProject.riskLevel = localProject.riskScore >= 80 ? "Critical" : localProject.riskScore >= 60 ? "High" : localProject.riskScore >= 40 ? "Medium" : "Low";
      newScore = localProject.riskScore;
    } else {
      localProject.feedbackStatus = "confirmed_issue";
      localProject.riskScore = Math.min(100, localProject.riskScore + 5);
      newScore = localProject.riskScore;
    }
  }

  // Attempt backend update
  try {
    const res = await fetchWithTimeout(`${BACKEND_BASE_URL}/feedback`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        work_id: workId,
        verdict,
        officer_notes: officerNotes,
        officer_id: officerId,
      }),
    });
    if (res.ok) {
      const data = await res.json();
      return {
        success: true,
        newRiskScore: data.new_risk_score ?? newScore,
        message: data.message || "Feedback recorded successfully.",
      };
    }
  } catch {}

  return delay({
    success: true,
    newRiskScore: newScore,
    message: verdict === "false_positive"
      ? "Project marked as False Positive. Risk score reduced by 25 points."
      : "Project marked as Reviewed and verified for supervisory follow-up.",
  }, 300);
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

  // Fallback to local citizen reports matching this project
  const matched = CITIZEN_REPORTS.filter((c) => c.projectId === workId);
  return delay(matched);
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
  let results = [...ALERTS];
  if (filters.status && filters.status !== "All") results = results.filter((a) => a.status === filters.status);
  if (filters.riskLevel && filters.riskLevel !== "All") results = results.filter((a) => a.riskLevel === filters.riskLevel);
  if (filters.type && filters.type !== "All") results = results.filter((a) => a.type === filters.type);
  if (filters.state && filters.state !== "All") {
    results = results.filter((a) => {
      const proj = PROJECTS.find((p) => p.id === a.projectId);
      return proj
        ? proj.state.toLowerCase() === filters.state?.toLowerCase()
        : a.location.toLowerCase().includes(filters.state?.toLowerCase() || "");
    });
  }
  if (filters.district && filters.district !== "All") {
    results = results.filter((a) => {
      const proj = PROJECTS.find((p) => p.id === a.projectId);
      return proj
        ? proj.district.toLowerCase() === filters.district?.toLowerCase()
        : a.location.toLowerCase().includes(filters.district?.toLowerCase() || "");
    });
  }
  if (filters.search) {
    const q = filters.search.toLowerCase();
    results = results.filter(
      (a) => a.id.toLowerCase().includes(q) || a.projectId.toLowerCase().includes(q) || a.projectName.toLowerCase().includes(q)
    );
  }
  return delay(results.sort((a, b) => b.riskScore - a.riskScore));
}

export async function updateAlertStatus(alertId: string, status: RiskAlert["status"]): Promise<RiskAlert | undefined> {
  const alert = ALERTS.find((a) => a.id === alertId);
  if (alert) alert.status = status;
  return delay(alert, 250);
}

// ---------------------------------------------------------------------------
// Analytics
// ---------------------------------------------------------------------------
export async function getAnalytics() {
  return delay({
    avgProjectCostTrend: [
      { label: "2021-22", value: 14.2 },
      { label: "2022-23", value: 15.1 },
      { label: "2023-24", value: 16.4 },
      { label: "2024-25", value: 17.8 },
    ],
    costDeviationByCategory: [
      { name: "Road", value: 8 },
      { name: "Community Hall", value: 22 },
      { name: "School Infra", value: 11 },
      { name: "Drinking Water", value: 14 },
      { name: "Sanitation", value: 6 },
      { name: "Healthcare", value: 9 },
    ],
    delayDistribution: [
      { name: "On Time", value: 62 },
      { name: "Minor Delay", value: 21 },
      { name: "Major Delay", value: 12 },
      { name: "Severely Delayed", value: 5 },
    ],
    riskTrend: [
      { label: "Q1", high: 62, critical: 18 },
      { label: "Q2", high: 71, critical: 22 },
      { label: "Q3", high: 78, critical: 29 },
      { label: "Q4", high: 82, critical: 31 },
    ],
    stateWise: STATE_RISK_DATA.map((s) => ({ name: s.state, value: s.highRisk + s.critical })),
    insights: [
      "Average project cost increased by 8.4% in the selected period.",
      "12% of projects in the selected category show elevated delay risk.",
      "Community Hall projects show the highest average cost deviation across categories.",
    ],
  });
}

// ---------------------------------------------------------------------------
// Risk Map
// ---------------------------------------------------------------------------
export async function getRiskMapData(): Promise<StateRiskData[]> {
  return delay(STATE_RISK_DATA);
}

// ---------------------------------------------------------------------------
// Citizen Reports
// ---------------------------------------------------------------------------
export async function getCitizenReports(limit?: number): Promise<CitizenReport[]> {
  const sorted = [...CITIZEN_REPORTS].sort((a, b) => (a.submittedDate < b.submittedDate ? 1 : -1));
  return delay(limit ? sorted.slice(0, limit) : sorted);
}

export interface CitizenReportSubmission {
  projectId: string;
  location: string;
  issueType: string;
  description: string;
  hasPhoto: boolean;
}

export async function submitCitizenReport(_submission: CitizenReportSubmission): Promise<{ id: string }> {
  const id = `CR-${100000 + Math.floor(Math.random() * 9000) + 1}`;
  return delay({ id }, 700);
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
  const stored = localStorage.getItem("mplads_officer_submitted_reports");
  if (stored) {
    try {
      return JSON.parse(stored);
    } catch {}
  }
  const defaults: SubmittedOfficerReport[] = [
    {
      id: "REP-OFF-101",
      officerName: "R. Kulkarni",
      officerEmail: "officer1@mplads.ai",
      state: "Maharashtra",
      district: "Pune",
      reportType: "Risk Summary",
      projectName: "Pune District High-Risk Works",
      generatedDate: new Date(Date.now() - 3600000 * 24).toLocaleString("en-IN"),
      summary: [
        { label: "Scope", value: "Maharashtra · Pune" },
        { label: "Flagged Projects", value: "5" },
        { label: "Estimated Risk Value", value: "₹3.8 Cr" },
      ],
      rows: [
        { project: "PRJ-MH-001 — Pune Rural Water Supply Augmentation", risk: "85/100 (Critical)", amount: "₹85.0L" },
        { project: "PRJ-MH-003 — Primary Health Center Wing Extension", risk: "74/100 (High)", amount: "₹65.0L" },
      ],
    },
    {
      id: "REP-OFF-102",
      officerName: "A. Deshmukh",
      officerEmail: "officer2@mplads.ai",
      state: "Karnataka",
      district: "Bengaluru Urban",
      reportType: "Project-wise",
      projectName: "PRJ-KA-001 — Community Skill Development Center",
      generatedDate: new Date(Date.now() - 3600000 * 12).toLocaleString("en-IN"),
      summary: [
        { label: "Scope", value: "Karnataka · Bengaluru Urban" },
        { label: "Project ID", value: "PRJ-KA-001" },
        { label: "Cost Deviation", value: "+28% vs Peer Avg" },
      ],
      rows: [
        { project: "PRJ-KA-001 — Community Skill Development Center", risk: "78/100 (High)", amount: "₹120.0L" },
      ],
    },
  ];
  localStorage.setItem("mplads_officer_submitted_reports", JSON.stringify(defaults));
  return delay(defaults, 250);
}

export async function submitReportToAdmin(
  reportData: Omit<SubmittedOfficerReport, "id" | "generatedDate">
): Promise<SubmittedOfficerReport> {
  const existing = await getSubmittedOfficerReports();
  const newReport: SubmittedOfficerReport = {
    ...reportData,
    id: `REP-OFF-${100 + existing.length + 1}`,
    generatedDate: new Date().toLocaleString("en-IN"),
  };
  const updated = [newReport, ...existing];
  localStorage.setItem("mplads_officer_submitted_reports", JSON.stringify(updated));
  return delay(newReport, 300);
}

export async function generateReport(request: ReportRequest): Promise<{
  title: string;
  generatedAt: string;
  summary: { label: string; value: string }[];
  rows: { project: string; risk: string; amount: string }[];
}> {
  // If specific project requested
  if (request.projectId) {
    const singleProj = PROJECTS.find((p) => p.id === request.projectId);
    if (singleProj) {
      return delay(
        {
          title: `Project Audit Report: ${singleProj.name} (${singleProj.id})`,
          generatedAt: new Date().toLocaleString("en-IN"),
          summary: [
            { label: "Project ID", value: singleProj.id },
            { label: "State & District", value: `${singleProj.state} · ${singleProj.district}` },
            { label: "Sanctioned Amount", value: `₹${(singleProj.sanctionedAmount / 100000).toFixed(1)}L` },
            { label: "Expenditure", value: `₹${(singleProj.expenditure / 100000).toFixed(1)}L` },
            { label: "Risk Score", value: `${singleProj.riskScore}/100 (${singleProj.riskLevel})` },
            { label: "Physical Progress", value: `${singleProj.physicalProgress}%` },
            { label: "Status", value: singleProj.status },
          ],
          rows: [
            { project: `${singleProj.id} — ${singleProj.name}`, risk: `${singleProj.riskScore}/100 (${singleProj.riskLevel})`, amount: `₹${(singleProj.sanctionedAmount / 100000).toFixed(1)}L` },
          ],
        },
        600
      );
    }
  }

  let pool = PROJECTS;
  if (request.state && request.state !== "All India") {
    pool = pool.filter((p) => p.state.toLowerCase() === request.state?.toLowerCase());
  }
  if (request.district && request.district !== "All Districts") {
    pool = pool.filter((p) => p.district.toLowerCase() === request.district?.toLowerCase());
  }
  if (request.riskLevel && request.riskLevel !== "All Levels") {
    pool = pool.filter((p) => p.riskLevel === request.riskLevel);
  }

  const sample = pool.slice(0, 10);
  const totalAmount = pool.reduce((acc, p) => acc + p.sanctionedAmount, 0);
  const highRiskCount = pool.filter((p) => p.riskScore >= 70).length;

  return delay(
    {
      title: request.type || "MPLADS Monitoring Report",
      generatedAt: new Date().toLocaleString("en-IN"),
      summary: [
        { label: "Total Projects Covered", value: String(pool.length) },
        { label: "High Risk Identified", value: String(highRiskCount) },
        { label: "Total Sanctioned Value", value: `₹${(totalAmount / 10000000).toFixed(2)} Cr` },
        { label: "Report Scope", value: request.state ? `${request.state}${request.district ? ` · ${request.district}` : ""}` : "All India" },
      ],
      rows: sample.map((p) => ({
        project: `${p.id} — ${p.name}`,
        risk: `${p.riskScore}/100 (${p.riskLevel})`,
        amount: `₹${(p.sanctionedAmount / 100000).toFixed(1)}L`,
      })),
    },
    700
  );
}

// ---------------------------------------------------------------------------
// Super Admin — Officer Management
// ---------------------------------------------------------------------------
export async function getOfficers(): Promise<OfficerAccount[]> {
  return delay([...OFFICERS]);
}

export async function updateOfficerStatus(
  officerId: string,
  status: OfficerAccount["status"]
): Promise<OfficerAccount | undefined> {
  const officer = OFFICERS.find((o) => o.id === officerId);
  if (officer) officer.status = status;
  return delay(officer, 250);
}

export interface NewOfficerInput {
  name: string;
  email: string;
  title: string;
  jurisdiction: string;
  state: string;
}

export async function addOfficer(input: NewOfficerInput): Promise<OfficerAccount> {
  const newOfficer: OfficerAccount = {
    id: `OFF-${String(OFFICERS.length + 1).padStart(3, "0")}`,
    ...input,
    status: "Active",
    projectsAssigned: 0,
    alertsHandled: 0,
    lastLogin: "Never",
  };
  OFFICERS.unshift(newOfficer);
  return delay(newOfficer, 500);
}

// ---------------------------------------------------------------------------
// Super Admin — System Overview & Audit Logs
// ---------------------------------------------------------------------------
export async function getSystemOverview() {
  return delay({
    totalOfficers: OFFICERS.length,
    activeOfficers: OFFICERS.filter((o) => o.status === "Active").length,
    totalStates: STATE_RISK_DATA.length,
    totalProjects: 12842,
    totalAlerts: ALERTS.length + 300,
    pendingCitizenReports: CITIZEN_REPORTS.filter((c) => c.status !== "Resolved").length,
    systemUptime: "99.97%",
    lastSync: new Date().toISOString(),
  });
}

export async function getAuditLogs(limit?: number): Promise<AuditLogEntry[]> {
  return delay(limit ? AUDIT_LOGS.slice(0, limit) : AUDIT_LOGS);
}

// ---------------------------------------------------------------------------
// Global Search
// ---------------------------------------------------------------------------
export async function globalSearch(query: string) {
  const q = query.toLowerCase();
  const projects = PROJECTS.filter(
    (p) => p.id.toLowerCase().includes(q) || p.name.toLowerCase().includes(q) || p.district.toLowerCase().includes(q)
  ).slice(0, 5);
  const alerts = ALERTS.filter((a) => a.id.toLowerCase().includes(q) || a.projectId.toLowerCase().includes(q)).slice(0, 5);
  return delay({ projects, alerts }, 200);
}
