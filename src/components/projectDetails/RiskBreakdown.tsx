import Card from "../ui/Card";
import { RiskBadge } from "../ui/Badge";
import type { Project } from "../../types";

const RISK_EXPLANATIONS: Record<string, string> = {
  costAnomaly: "Expenditure pattern deviates from the expected cost envelope for similar works.",
  duplicateProbability: "Semantic similarity with another sanctioned project detected via NLP analysis.",
  delayRisk: "Physical progress trails behind the expected implementation timeline.",
  paymentAnomaly: "Payment disbursement pattern differs from typical scheme behaviour.",
  satelliteVerification: "Satellite imagery signal suggests a field visit may be warranted.",
  citizenSignal: "Aggregated signal derived from citizen-submitted reports for this project.",
};

const LABELS: Record<string, string> = {
  costAnomaly: "Cost Anomaly",
  duplicateProbability: "Duplicate Similarity",
  delayRisk: "Delay Risk",
  paymentAnomaly: "Payment Anomaly",
  satelliteVerification: "Satellite Verification",
  citizenSignal: "Citizen Signal",
};

const LEVEL_WIDTH: Record<string, number> = { Low: 25, Medium: 50, High: 80, Critical: 100, Review: 65 };
const LEVEL_COLOR: Record<string, string> = {
  Low: "#16a34a",
  Medium: "#d97706",
  High: "#ea580c",
  Critical: "#dc2626",
  Review: "#6b7280",
};

export default function RiskBreakdown({ project }: { project: Project }) {
  return (
    <Card>
      <div className="flex items-center justify-between mb-1">
        <h3 className="font-semibold text-gray-900">Risk Category Breakdown</h3>
      </div>
      <div className="flex items-baseline gap-3 mb-5">
        <span className="text-4xl font-bold text-gray-900">{project.riskScore}</span>
        <span className="text-gray-400 text-sm">/ 100</span>
        <RiskBadge level={project.riskLevel} />
      </div>
      <div className="space-y-4">
        {Object.entries(project.riskFactors).map(([key, level]) => (
          <div key={key}>
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-gray-700">{LABELS[key]}</span>
              <RiskBadge level={level} size="sm" />
            </div>
            <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
              <div
                className="h-full rounded-full transition-all"
                style={{ width: `${LEVEL_WIDTH[level] ?? 20}%`, backgroundColor: LEVEL_COLOR[level] ?? "#9ca3af" }}
              />
            </div>
            <p className="text-xs text-gray-400 mt-1">{RISK_EXPLANATIONS[key]}</p>
          </div>
        ))}
      </div>
    </Card>
  );
}
