export type RiskLevel = "Low" | "Medium" | "High" | "Critical";

export type ProjectStatus =
  | "Not Started"
  | "In Progress"
  | "Completed"
  | "Delayed";

export type ProjectCategory =
  | "Road"
  | "Community Hall"
  | "School Infrastructure"
  | "Drinking Water"
  | "Sanitation"
  | "Healthcare"
  | "Street Lighting"
  | "Public Infrastructure";

export interface Project {
  id: string;
  name: string;
  state: string;
  district: string;
  constituency: string;
  category: ProjectCategory;
  workType: string;
  implementingAgency: string;
  sanctionDate: string;
  expectedCompletion: string;
  status: ProjectStatus;
  sanctionedAmount: number; // INR
  releasedAmount: number;
  expenditure: number;
  physicalProgress: number; // %
  expectedProgress: number; // %
  riskScore: number; // 0-100
  riskLevel: RiskLevel;
  year: number;
  latitude: number;
  longitude: number;
  riskFactors: {
    costAnomaly: RiskLevel | "Review";
    duplicateProbability: RiskLevel | "Review";
    delayRisk: RiskLevel | "Review";
    paymentAnomaly: RiskLevel | "Review";
    satelliteVerification: RiskLevel | "Review";
    citizenSignal: RiskLevel | "Review";
  };
  shapFactors: { label: string; value: number }[];
  peerAverageCost: number;
  similarProjectId?: string;
  similarProjectName?: string;
  similarityScore?: number;
  similarState?: string;
  flagReason?: string;
  costZScore?: number;
  costAnomalyScore?: number;
  duplicateSimilarityScore?: number;
  satelliteStatus?: string;
  satelliteRiskScore?: number;
  satellitePassDate?: string;
  showcaseOrder?: number;
  citizenReportCount?: number;
  feedbackStatus?: "confirmed_issue" | "false_positive" | "reviewed" | null;
  aiExplanation?: string;
  mpName?: string;
  contractor?: string;
}

export type AlertType =
  | "Cost Anomaly"
  | "Duplicate Work"
  | "Delay"
  | "Payment Anomaly"
  | "Satellite Verification"
  | "Citizen Signal";

export type AlertStatus = "Open" | "Under Review" | "Assigned" | "Resolved";

export interface RiskAlert {
  id: string;
  projectId: string;
  projectName: string;
  location: string;
  riskScore: number;
  riskLevel: RiskLevel;
  type: AlertType;
  description: string;
  detectedDate: string;
  status: AlertStatus;
  assignedOfficer?: string;
  recommendedAction: string;
  evidence: string[];
}

export type IssueType =
  | "Work not started"
  | "Work incomplete"
  | "Poor quality"
  | "Project not found"
  | "Possible duplicate work"
  | "Other";

export interface CitizenReport {
  id: string;
  projectId: string;
  projectName: string;
  location: string;
  issueType: IssueType;
  description: string;
  submittedDate: string;
  status: "Received" | "Under Review" | "Resolved";
  hasPhoto: boolean;
}

export interface StateRiskData {
  state: string;
  totalProjects: number;
  highRisk: number;
  critical: number;
  alerts: number;
  fundUtilization: number;
  riskLevel: RiskLevel;
}

export interface DashboardStats {
  totalProjects: number;
  totalProjectsTrend: number;
  highRiskProjects: number;
  highRiskTrend: number;
  activeAlerts: number;
  activeAlertsTrend: number;
  fundUtilization: number;
  fundUtilizationTrend: number;
  delayedProjects: number;
  delayedTrend: number;
  lastUpdated: string;
  // 4 Top KPIs for Redesign
  totalProjectsScanned?: number;
  highRiskFlaggedCount?: number;
  citizenReportsCount?: number;
  avgRiskScore?: number;
  totalDisbursed?: number;
  riskDistribution?: { low: number; medium: number; high: number; critical: number };
}

export type OfficerStatus = "Active" | "Inactive";

export interface OfficerAccount {
  id: string;
  name: string;
  email: string;
  title: string;
  jurisdiction: string;
  state: string;
  status: OfficerStatus;
  projectsAssigned: number;
  alertsHandled: number;
  lastLogin: string;
}

export type AuditActionType =
  | "Login"
  | "Logout"
  | "Alert Resolved"
  | "Alert Assigned"
  | "Alert Under Review"
  | "Report Generated"
  | "Officer Added"
  | "Officer Deactivated"
  | "Officer Activated"
  | "Settings Updated"
  | "Citizen Report Reviewed";

export interface AuditLogEntry {
  id: string;
  actor: string;
  actorRole: "Officer" | "Super Admin";
  action: AuditActionType;
  target: string;
  timestamp: string;
  ipAddress: string;
}

export interface NotificationItem {
  id: string;
  title: string;
  time: string;
  type: "critical" | "info" | "warning";
  read: boolean;
}
