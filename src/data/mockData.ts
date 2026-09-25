import type {
  Project,
  RiskAlert,
  CitizenReport,
  StateRiskData,
  RiskLevel,
  ProjectCategory,
  ProjectStatus,
  AlertType,
  OfficerAccount,
  AuditLogEntry,
  AuditActionType,
} from "../types";

// ---------- Deterministic pseudo-random helper (stable across renders) ----------
function seededRandom(seed: number) {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}
const rand = seededRandom(42);
function pick<T>(arr: T[]): T {
  return arr[Math.floor(rand() * arr.length)];
}
function randInt(min: number, max: number) {
  return Math.floor(rand() * (max - min + 1)) + min;
}

const STATES_DISTRICTS: Record<string, string[]> = {
  Maharashtra: ["Pune", "Nashik", "Nagpur", "Ahilyanagar", "Satara", "Kolhapur"],
  Gujarat: ["Ahmedabad", "Surat", "Vadodara", "Rajkot"],
  Karnataka: ["Bengaluru Urban", "Mysuru", "Belagavi", "Hubballi"],
  Rajasthan: ["Jaipur", "Jodhpur", "Udaipur", "Kota"],
  "Madhya Pradesh": ["Bhopal", "Indore", "Gwalior", "Jabalpur"],
  "Uttar Pradesh": ["Lucknow", "Kanpur", "Varanasi", "Agra"],
  "Tamil Nadu": ["Chennai", "Coimbatore", "Madurai", "Salem"],
  Punjab: ["Amritsar", "Ludhiana", "Patiala"],
  "West Bengal": ["Kolkata", "Howrah", "Durgapur"],
  Bihar: ["Patna", "Gaya", "Bhagalpur"],
};

const STATE_COORDS: Record<string, [number, number]> = {
  Maharashtra: [19.75, 75.71],
  Gujarat: [22.26, 71.19],
  Karnataka: [15.32, 75.71],
  Rajasthan: [27.02, 74.22],
  "Madhya Pradesh": [22.97, 78.66],
  "Uttar Pradesh": [26.85, 80.95],
  "Tamil Nadu": [11.13, 78.66],
  Punjab: [31.15, 75.34],
  "West Bengal": [22.99, 87.85],
  Bihar: [25.1, 85.31],
};

const CATEGORIES: ProjectCategory[] = [
  "Road",
  "Community Hall",
  "School Infrastructure",
  "Drinking Water",
  "Sanitation",
  "Healthcare",
  "Street Lighting",
  "Public Infrastructure",
];

const WORK_TYPE_BY_CATEGORY: Record<ProjectCategory, string[]> = {
  Road: ["Village Road Construction", "Road Widening & Repair", "Concrete Road Laying"],
  "Community Hall": ["Community Hall Construction", "Community Hall Renovation"],
  "School Infrastructure": ["Classroom Construction", "School Building Renovation", "Furniture & Fixtures"],
  "Drinking Water": ["Bore Well Installation", "Overhead Water Tank", "Pipeline Extension"],
  Sanitation: ["Public Toilet Construction", "Drainage System Upgrade"],
  Healthcare: ["Primary Health Sub-Centre Upgrade", "Ambulance Procurement"],
  "Street Lighting": ["Solar Street Light Installation", "LED Streetlight Upgrade"],
  "Public Infrastructure": ["Community Ground Development", "Public Park Development", "Bus Shelter Construction"],
};

const AGENCIES = [
  "District Rural Development Agency",
  "Public Works Department",
  "Zilla Parishad",
  "Municipal Corporation",
  "State Implementation Agency",
];

function riskLevelFromScore(score: number): RiskLevel {
  if (score >= 80) return "Critical";
  if (score >= 60) return "High";
  if (score >= 35) return "Medium";
  return "Low";
}

function fmtDate(daysAgoStart: number, daysAgoEnd: number) {
  const days = randInt(daysAgoEnd, daysAgoStart);
  const d = new Date();
  d.setDate(d.getDate() - days);
  return d.toISOString().split("T")[0];
}

function generateProject(index: number): Project {
  const state = pick(Object.keys(STATES_DISTRICTS));
  const district = pick(STATES_DISTRICTS[state]);
  const category = pick(CATEGORIES);
  const workType = pick(WORK_TYPE_BY_CATEGORY[category]);
  const sanctionedAmount = randInt(800000, 3500000); // 8L - 35L
  const riskScore = randInt(5, 98);
  const riskLevel = riskLevelFromScore(riskScore);

  const isAnomalous = riskScore >= 60;
  const expenditureMultiplier = isAnomalous ? 1.2 + rand() * 0.6 : 0.7 + rand() * 0.35;
  const expenditure = Math.round(sanctionedAmount * expenditureMultiplier);
  const releasedAmount = Math.round(sanctionedAmount * (0.6 + rand() * 0.4));

  const expectedProgress = randInt(40, 100);
  const physicalProgress = isAnomalous
    ? Math.max(5, expectedProgress - randInt(15, 45))
    : Math.max(10, expectedProgress - randInt(0, 12));

  const statusPool: ProjectStatus[] =
    physicalProgress >= 98
      ? ["Completed"]
      : expectedProgress - physicalProgress > 20
      ? ["Delayed"]
      : ["In Progress", "In Progress", "Not Started"];
  const status = pick(statusPool);

  const [lat, lng] = STATE_COORDS[state];
  const latitude = lat + (rand() - 0.5) * 2.5;
  const longitude = lng + (rand() - 0.5) * 2.5;

  const costDeviationPct = Math.round(((expenditure - sanctionedAmount) / sanctionedAmount) * 100);

  const shapFactors = [
    { label: "Cost deviation", value: isAnomalous ? randInt(14, 26) : randInt(2, 8) },
    { label: "Low physical progress", value: isAnomalous ? randInt(10, 22) : randInt(1, 6) },
    { label: "Payment pattern irregularity", value: isAnomalous ? randInt(8, 18) : randInt(0, 5) },
    { label: "Duplicate similarity", value: isAnomalous ? randInt(6, 16) : randInt(0, 4) },
    { label: "Citizen reports", value: randInt(2, 12) },
    { label: "Other contextual factors", value: randInt(3, 10) },
  ].sort((a, b) => b.value - a.value);

  const riskOptions: (RiskLevel | "Review")[] = ["Low", "Medium", "High", "Critical", "Review"];

  const flagReason = costDeviationPct > 20
    ? `Expenditure exceeds sanctioned estimate by ${costDeviationPct}% (Cost outlier)`
    : isAnomalous && rand() > 0.5
    ? `High semantic overlap with adjacent sanctioned work (${randInt(82, 96)}% match)`
    : expectedProgress - physicalProgress > 20
    ? `Physical progress lagging ${expectedProgress - physicalProgress}% behind scheduled milestone`
    : isAnomalous && rand() > 0.4
    ? `Disbursement pattern irregularity flagged for supervisory review`
    : `Multi-signal risk score exceeds monitoring threshold (${riskScore}/100)`;

  const mpPool = ["Shri Prakash Jawadekar", "Smt. Supriya Sule", "Shri Nitin Gadkari", "Shri Rahul Gandhi", "Shri Anurag Thakur", "Dr. Shashi Tharoor"];
  const contractorPool = ["Rites Infrastructure Ltd.", "Vikas Construction Co.", "National Building Const. Corp", "Shree Ram Engineering Works", "Adarsh Buildcon Pvt Ltd"];

  return {
    id: `MPL-${10001 + index}`,
    name: `${workType} — ${district}`,
    state,
    district,
    constituency: `${district} Lok Sabha Constituency`,
    category,
    workType,
    implementingAgency: pick(AGENCIES),
    sanctionDate: fmtDate(900, 400),
    expectedCompletion: fmtDate(-300, 60),
    status,
    sanctionedAmount,
    releasedAmount,
    expenditure,
    physicalProgress,
    expectedProgress,
    riskScore,
    riskLevel,
    year: 2024 + (index % 3),
    latitude,
    longitude,
    riskFactors: {
      costAnomaly: costDeviationPct > 25 ? "High" : costDeviationPct > 10 ? "Medium" : "Low",
      duplicateProbability: isAnomalous && rand() > 0.5 ? "High" : "Low",
      delayRisk: expectedProgress - physicalProgress > 20 ? "High" : expectedProgress - physicalProgress > 8 ? "Medium" : "Low",
      paymentAnomaly: isAnomalous && rand() > 0.4 ? "High" : "Low",
      satelliteVerification: isAnomalous && rand() > 0.6 ? "Review" : "Low",
      citizenSignal: pick(riskOptions.slice(0, 3)),
    },
    shapFactors,
    peerAverageCost: Math.round(sanctionedAmount * (0.9 + rand() * 0.2)),
    similarProjectId: isAnomalous && rand() > 0.5 ? `MPL-${10001 + ((index + 17) % 48)}` : undefined,
    similarProjectName: isAnomalous && rand() > 0.5 ? `${pick(WORK_TYPE_BY_CATEGORY[category])} — ${district}` : undefined,
    similarityScore: isAnomalous ? randInt(80, 97) : undefined,
    similarState: state,
    flagReason,
    costZScore: isAnomalous ? +(2.1 + rand() * 1.8).toFixed(2) : +(0.4 + rand() * 0.8).toFixed(2),
    costAnomalyScore: costDeviationPct > 15 ? randInt(65, 95) : randInt(10, 40),
    duplicateSimilarityScore: isAnomalous ? randInt(75, 95) : undefined,
    satelliteStatus: isAnomalous && rand() > 0.5 ? "Spectral change unverified" : "Activity confirmed",
    satelliteRiskScore: isAnomalous && rand() > 0.5 ? randInt(55, 88) : randInt(10, 30),
    citizenReportCount: randInt(0, 3),
    feedbackStatus: null,
    aiExplanation: isAnomalous
      ? `Flagged for supervisory review due to a ${costDeviationPct > 0 ? costDeviationPct + '% expenditure deviation' : 'schedule delay'} combined with semantic duplication markers in ${district}. Ground physical verification is recommended.`
      : `Project metrics fall within standard baseline variance for ${category} works in ${district}. No critical intervention needed at this stage.`,
    mpName: pick(mpPool),
    contractor: pick(contractorPool),
  };
}

export const PROJECTS: Project[] = Array.from({ length: 48 }, (_, i) => generateProject(i));

// ---------------- Alerts ----------------
const ALERT_TYPES: AlertType[] = [
  "Cost Anomaly",
  "Duplicate Work",
  "Delay",
  "Payment Anomaly",
  "Satellite Verification",
  "Citizen Signal",
];

const ALERT_DESCRIPTIONS: Record<AlertType, string[]> = {
  "Cost Anomaly": [
    "Expenditure exceeds peer average by a significant margin.",
    "Unusual cost escalation detected against sanctioned estimate.",
  ],
  "Duplicate Work": [
    "High semantic similarity found with another sanctioned project.",
    "Possible overlapping scope with a nearby project detected.",
  ],
  Delay: [
    "Physical progress significantly behind expected timeline.",
    "No progress update recorded for an extended period.",
  ],
  "Payment Anomaly": [
    "Payment pattern deviates from typical disbursement schedule.",
    "Multiple payments released without corresponding progress update.",
  ],
  "Satellite Verification": [
    "Satellite imagery suggests limited visible construction activity.",
    "Physical verification recommended based on imagery analysis.",
  ],
  "Citizen Signal": [
    "Multiple citizen reports received regarding this project.",
    "Citizen report flags discrepancy with official status.",
  ],
};

function generateAlert(index: number): RiskAlert {
  const project = pick(PROJECTS.filter((p) => p.riskScore >= 45));
  const type = pick(ALERT_TYPES);
  const riskScore = randInt(45, 97);
  const statusPool: RiskAlert["status"][] = ["Open", "Open", "Under Review", "Assigned", "Resolved"];
  return {
    id: `ALT-${20001 + index}`,
    projectId: project.id,
    projectName: project.name,
    location: `${project.district}, ${project.state}`,
    riskScore,
    riskLevel: riskLevelFromScore(riskScore),
    type,
    description: pick(ALERT_DESCRIPTIONS[type]),
    detectedDate: fmtDate(60, 0),
    status: pick(statusPool),
    assignedOfficer: rand() > 0.5 ? pick(["R. Sharma", "A. Deshmukh", "K. Iyer", "S. Verma"]) : undefined,
    recommendedAction:
      type === "Cost Anomaly"
        ? "Request expenditure justification and site audit."
        : type === "Duplicate Work"
        ? "Cross-verify scope with the similar sanctioned project."
        : type === "Delay"
        ? "Contact implementing agency for revised timeline."
        : type === "Payment Anomaly"
        ? "Review payment vouchers against work measurement."
        : type === "Satellite Verification"
        ? "Schedule field verification visit."
        : "Review citizen-submitted evidence and respond.",
    evidence: ["Financial Records", "Progress Reports", "Satellite Snapshot", "Citizen Submission"].filter(
      () => rand() > 0.4
    ),
  };
}

export const ALERTS: RiskAlert[] = Array.from({ length: 40 }, (_, i) => generateAlert(i));

// ---------------- Citizen Reports ----------------
const ISSUE_TYPES: CitizenReport["issueType"][] = [
  "Work not started",
  "Work incomplete",
  "Poor quality",
  "Project not found",
  "Possible duplicate work",
  "Other",
];

function generateCitizenReport(index: number): CitizenReport {
  const project = pick(PROJECTS);
  return {
    id: `CR-${102900 + index}`,
    projectId: project.id,
    projectName: project.name,
    location: `${project.district}, ${project.state}`,
    issueType: pick(ISSUE_TYPES),
    description: "Citizen-submitted observation regarding on-ground project status.",
    submittedDate: fmtDate(30, 0),
    status: pick(["Received", "Under Review", "Resolved"]),
    hasPhoto: rand() > 0.4,
  };
}

export const CITIZEN_REPORTS: CitizenReport[] = Array.from({ length: 18 }, (_, i) => generateCitizenReport(i));

// ---------------- State-level risk map data ----------------
export const STATE_RISK_DATA: StateRiskData[] = Object.keys(STATES_DISTRICTS).map((state) => {
  const stateProjects = PROJECTS.filter((p) => p.state === state);
  const totalProjects = randInt(600, 1800);
  const highRisk = stateProjects.filter((p) => p.riskLevel === "High").length * randInt(8, 14) + randInt(5, 20);
  const critical = stateProjects.filter((p) => p.riskLevel === "Critical").length * randInt(3, 6) + randInt(1, 8);
  const alerts = highRisk + critical + randInt(10, 60);
  const fundUtilization = randInt(58, 88);
  const riskScoreAvg = (highRisk * 2 + critical * 4) / (totalProjects / 40);
  return {
    state,
    totalProjects,
    highRisk,
    critical,
    alerts,
    fundUtilization,
    riskLevel: riskLevelFromScore(Math.min(95, riskScoreAvg + 20)),
  };
});

export const DISTRICTS_BY_STATE = STATES_DISTRICTS;
export const ALL_CATEGORIES = CATEGORIES;

// ---------------- Officer Accounts (Super Admin management) ----------------
export const OFFICERS: OfficerAccount[] = [
  {
    id: "OFF-001",
    name: "R. Kulkarni",
    email: "officer1@mplads.ai",
    title: "District Monitoring Officer",
    jurisdiction: "Pune, Maharashtra",
    state: "Maharashtra",
    status: "Active",
    projectsAssigned: 214,
    alertsHandled: 38,
    lastLogin: fmtDate(2, 0),
  },
  {
    id: "OFF-002",
    name: "A. Deshmukh",
    email: "officer2@mplads.ai",
    title: "District Monitoring Officer",
    jurisdiction: "Bengaluru, Karnataka",
    state: "Karnataka",
    status: "Active",
    projectsAssigned: 178,
    alertsHandled: 29,
    lastLogin: fmtDate(1, 0),
  },
  {
    id: "OFF-003",
    name: "K. Iyer",
    email: "officer3@mplads.ai",
    title: "State Nodal Officer",
    jurisdiction: "Lucknow, Uttar Pradesh",
    state: "Uttar Pradesh",
    status: "Active",
    projectsAssigned: 342,
    alertsHandled: 61,
    lastLogin: fmtDate(0, 0),
  },
  {
    id: "OFF-004",
    name: "S. Verma",
    email: "officer4@mplads.ai",
    title: "District Monitoring Officer",
    jurisdiction: "Jaipur, Rajasthan",
    state: "Rajasthan",
    status: "Inactive",
    projectsAssigned: 96,
    alertsHandled: 12,
    lastLogin: fmtDate(45, 30),
  },
  {
    id: "OFF-005",
    name: "M. Reddy",
    email: "officer5@mplads.ai",
    title: "District Monitoring Officer",
    jurisdiction: "Chennai, Tamil Nadu",
    state: "Tamil Nadu",
    status: "Active",
    projectsAssigned: 152,
    alertsHandled: 24,
    lastLogin: fmtDate(3, 1),
  },
  {
    id: "OFF-006",
    name: "N. Singh",
    email: "officer6@mplads.ai",
    title: "District Monitoring Officer",
    jurisdiction: "Jaipur, Rajasthan",
    state: "Rajasthan",
    status: "Active",
    projectsAssigned: 133,
    alertsHandled: 19,
    lastLogin: fmtDate(5, 2),
  },
];

// ---------------- Audit / Activity Logs (Super Admin) ----------------
const AUDIT_ACTORS = [
  { name: "R. Kulkarni", role: "Officer" as const },
  { name: "A. Deshmukh", role: "Officer" as const },
  { name: "K. Iyer", role: "Officer" as const },
  { name: "S. Verma", role: "Officer" as const },
  { name: "P. Sharma", role: "Super Admin" as const },
];

const AUDIT_ACTIONS: AuditActionType[] = [
  "Login",
  "Logout",
  "Alert Resolved",
  "Alert Assigned",
  "Alert Under Review",
  "Report Generated",
  "Officer Added",
  "Officer Deactivated",
  "Officer Activated",
  "Settings Updated",
  "Citizen Report Reviewed",
];

function generateAuditLog(index: number): AuditLogEntry {
  const actor = pick(AUDIT_ACTORS);
  const action = pick(AUDIT_ACTIONS);
  const targetPool =
    action.includes("Alert") ? ALERTS.map((a) => a.id) :
    action.includes("Officer") ? OFFICERS.map((o) => o.name) :
    action === "Report Generated" ? ["Risk Summary", "State Report", "Complete MPLADS Report"] :
    action === "Citizen Report Reviewed" ? CITIZEN_REPORTS.map((c) => c.id) :
    ["System"];
  return {
    id: `LOG-${300000 + index}`,
    actor: actor.name,
    actorRole: actor.role,
    action,
    target: pick(targetPool),
    timestamp: fmtDate(30, 0) + "T" + `${randInt(6, 21)}`.padStart(2, "0") + ":" + `${randInt(0, 59)}`.padStart(2, "0"),
    ipAddress: `10.${randInt(0, 255)}.${randInt(0, 255)}.${randInt(1, 254)}`,
  };
}

export const AUDIT_LOGS: AuditLogEntry[] = Array.from({ length: 60 }, (_, i) => generateAuditLog(i)).sort((a, b) =>
  a.timestamp < b.timestamp ? 1 : -1
);
