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

function delay<T>(data: T, ms = NETWORK_DELAY): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(data), ms));
}

// ---------------------------------------------------------------------------
// Dashboard
// ---------------------------------------------------------------------------
export async function getDashboardStats(): Promise<DashboardStats> {
  const totalSanctioned = PROJECTS.reduce((s, p) => s + p.sanctionedAmount, 0);
  const totalExpenditure = PROJECTS.reduce((s, p) => s + p.expenditure, 0);

  return delay({
    totalProjects: 12842,
    totalProjectsTrend: 3.2,
    highRiskProjects: 82,
    highRiskTrend: 6.1,
    activeAlerts: ALERTS.filter((a) => a.status !== "Resolved").length + 300,
    activeAlertsTrend: -2.4,
    fundUtilization: Math.round((totalExpenditure / totalSanctioned) * 1000) / 10,
    fundUtilizationTrend: 1.8,
    delayedProjects: 126,
    delayedTrend: 4.5,
    lastUpdated: new Date().toISOString(),
  });
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
  if (filters.state) results = results.filter((p) => p.state === filters.state);
  if (filters.district) results = results.filter((p) => p.district === filters.district);
  if (filters.category) results = results.filter((p) => p.category === filters.category);
  if (filters.status) results = results.filter((p) => p.status === filters.status);
  if (filters.riskLevel) results = results.filter((p) => p.riskLevel === filters.riskLevel);
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

export async function getProjectById(id: string): Promise<Project | undefined> {
  return delay(PROJECTS.find((p) => p.id === id));
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------
export interface AlertFilters {
  status?: string;
  riskLevel?: string;
  type?: string;
  search?: string;
}

export async function getRiskAlerts(filters: AlertFilters = {}): Promise<RiskAlert[]> {
  let results = [...ALERTS];
  if (filters.status && filters.status !== "All") results = results.filter((a) => a.status === filters.status);
  if (filters.riskLevel && filters.riskLevel !== "All") results = results.filter((a) => a.riskLevel === filters.riskLevel);
  if (filters.type) results = results.filter((a) => a.type === filters.type);
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
}

export async function generateReport(request: ReportRequest): Promise<{
  title: string;
  generatedAt: string;
  summary: { label: string; value: string }[];
  rows: { project: string; risk: string; amount: string }[];
}> {
  const sample = PROJECTS.filter((p) => (request.riskLevel ? p.riskLevel === request.riskLevel : true)).slice(0, 8);
  return delay(
    {
      title: request.type,
      generatedAt: new Date().toLocaleString("en-IN"),
      summary: [
        { label: "Total Projects Covered", value: String(PROJECTS.length * 40) },
        { label: "High Risk Identified", value: "82" },
        { label: "Total Sanctioned Value", value: "₹412.6 Cr" },
        { label: "Report Scope", value: request.state ?? "All India" },
      ],
      rows: sample.map((p) => ({
        project: `${p.id} — ${p.name}`,
        risk: `${p.riskScore}/100 (${p.riskLevel})`,
        amount: `₹${(p.sanctionedAmount / 100000).toFixed(1)}L`,
      })),
    },
    900
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
