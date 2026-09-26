import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePortalBase } from "../lib/usePortalBase";
import {
  ChevronLeft,
  CheckCircle2,
  ShieldAlert,
  Sparkles,
  AlertCircle,
  FileCheck,
  MapPinned,
  Clock3,
  UserRoundCheck,
} from "lucide-react";
import Tabs from "../components/ui/Tabs";
import { RiskBadge, StatusBadge } from "../components/ui/Badge";
import Button from "../components/ui/Button";
import Modal from "../components/ui/Modal";
import Card from "../components/ui/Card";
import { Skeleton, ErrorState } from "../components/ui/Feedback";
import { getProjectById, submitProjectFeedback } from "../services/api";
import type { Project } from "../types";
import { useToast } from "../context/ToastContext";
import { useAuth } from "../context/AuthContext";

import ProjectOverview from "../components/projectDetails/ProjectOverview";
import FinancialOverview from "../components/projectDetails/FinancialOverview";
import ProgressTimeline from "../components/projectDetails/ProgressTimeline";
import RiskBreakdown from "../components/projectDetails/RiskBreakdown";
import SHAPChart from "../components/projectDetails/SHAPChart";
import EvidenceCard from "../components/projectDetails/EvidenceCard";
import ProjectCitizenReports from "../components/projectDetails/ProjectCitizenReports";

const TABS = ["Overview", "Financial", "Progress", "AI Analysis", "Evidence", "Citizen Reports"];

export default function ProjectDetail() {
  const params = useParams();
  const rawId = params["*"] || params.id || "";
  const id = rawId ? decodeURIComponent(rawId).trim() : "";
  const navigate = useNavigate();
  const portalBase = usePortalBase();
  const { showToast } = useToast();
  const { user } = useAuth();

  const isOfficer = user?.role === "officer" || !portalBase.includes("admin");
  const officerAssignedState = isOfficer ? (user?.assignedState || user?.jurisdiction || "Maharashtra") : "";

  const [project, setProject] = useState<Project | null | undefined>(null);
  const [tab, setTab] = useState("Overview");

  // Review Feedback modal state
  const [feedbackModal, setFeedbackModal] = useState<"confirmed_issue" | "false_positive" | null>(null);
  const [officerNotes, setOfficerNotes] = useState("");
  const [submittingFeedback, setSubmittingFeedback] = useState(false);

  useEffect(() => {
    setProject(null);
    if (id) {
      getProjectById(id).then((p) => setProject(p ?? undefined));
    }
  }, [id]);

  async function handleConfirmFeedback() {
    if (!project || !feedbackModal) return;
    setSubmittingFeedback(true);

    try {
      const result = await submitProjectFeedback(
        project.id,
        feedbackModal,
        officerNotes,
        "OFF-001"
      );

      if (result.success) {
        showToast(result.message, "success");
        // Update local project state immediately
        setProject((prev) => {
          if (!prev) return prev;
          const updatedScore = result.newRiskScore ?? (feedbackModal === "false_positive" ? Math.max(0, prev.riskScore - 25) : Math.min(100, prev.riskScore + 5));
          const updatedLevel = updatedScore >= 80 ? "Critical" : updatedScore >= 60 ? "High" : updatedScore >= 35 ? "Medium" : "Low";
          return {
            ...prev,
            feedbackStatus: feedbackModal,
            riskScore: updatedScore,
            riskLevel: updatedLevel,
            status: prev.status,
          };
        });
      } else {
        showToast("Failed to submit review feedback.", "error");
      }
    } catch {
      showToast("Error communicating with review service.", "error");
    } finally {
      setSubmittingFeedback(false);
      setFeedbackModal(null);
      setOfficerNotes("");
    }
  }

  if (project === undefined) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate(`${portalBase}/projects`)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
        >
          <ChevronLeft size={16} /> Back to Projects
        </button>
        <ErrorState message={`No project found with Work ID "${id}".`} />
      </div>
    );
  }

  if (project && isOfficer && officerAssignedState && project.state.toLowerCase() !== officerAssignedState.toLowerCase()) {
    return (
      <div className="space-y-4">
        <button
          onClick={() => navigate(`${portalBase}/projects`)}
          className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 dark:text-gray-400 dark:hover:text-white"
        >
          <ChevronLeft size={16} /> Back to {officerAssignedState} Projects
        </button>
        <div className="bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 rounded-lg p-6 text-center max-w-lg mx-auto">
          <ShieldAlert className="w-12 h-12 text-red-600 dark:text-red-400 mx-auto mb-3" />
          <h3 className="text-lg font-bold text-red-900 dark:text-red-200">Jurisdiction Access Restricted</h3>
          <p className="text-sm text-red-700 dark:text-red-300 mt-2">
            This project ({project.id}) is located in <strong>{project.state}</strong>. Your officer account is restricted to <strong>{officerAssignedState}</strong> jurisdiction only.
          </p>
          <Button className="mt-4" onClick={() => navigate(`${portalBase}/projects`)}>
            Return to {officerAssignedState} Projects
          </Button>
        </div>
      </div>
    );
  }

  const isFalsePositive = project?.feedbackStatus === "false_positive";
  const isConfirmed = project?.feedbackStatus === "confirmed_issue";
  const hasTrustedCoordinates = project?.locationPrecision === "locality" || project?.locationPrecision === "precise";
  const recommendedAction = !hasTrustedCoordinates
    ? { title: "Request precise site coordinates", detail: "The current location is district-level or unavailable. Ask the implementing agency for project GPS before drawing a satellite conclusion.", icon: MapPinned, tone: "amber" }
    : (project?.citizenReportCount || 0) > 0 || (project?.riskScore || 0) >= 80 || Math.abs(project?.costZScore || 0) >= 3
    ? { title: "Send an officer for field inspection", detail: "The combined anomaly strength warrants on-site verification of scope, expenditure and physical progress.", icon: UserRoundCheck, tone: "red" }
    : { title: "Review imagery, then recheck in 7 days", detail: "Coordinates are trusted, but reference imagery alone cannot confirm execution. Compare documents now and schedule a short follow-up.", icon: Clock3, tone: "blue" };

  return (
    <div className="space-y-5 animate-fade-in pb-10">
      {/* Top Breadcrumb */}
      <button
        onClick={() => navigate(`${portalBase}/projects`)}
        className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white transition-colors"
      >
        <ChevronLeft size={16} /> Back to Projects List
      </button>

      {!project ? (
        <div className="space-y-4">
          <Skeleton className="h-10 w-1/3" />
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      ) : (
        <>
          {/* Main Dossier Header */}
          <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-700 rounded-xl p-5 shadow-sm space-y-4">
            <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
              <div>
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-navy-800 dark:text-saffron-400 bg-navy-50 dark:bg-navy-950 px-2 py-0.5 rounded border border-navy-100 dark:border-navy-800">
                    {project.id}
                  </span>
                  <StatusBadge status={project.status} />
                  <span className="text-xs text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-navy-800 px-2 py-0.5 rounded">
                    {project.category}
                  </span>
                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-[10px] font-extrabold ${isFalsePositive ? "bg-emerald-100 text-emerald-800" : isConfirmed ? "bg-red-100 text-red-800" : "bg-red-700 text-white"}`}>
                    {isFalsePositive ? <CheckCircle2 size={11} /> : <ShieldAlert size={11} />}
                    {isFalsePositive ? "GENUINE · FLAG CLEARED" : isConfirmed ? "FIELD INSPECTION REQUIRED" : "ANOMALY DETECTED"}
                  </span>
                </div>
                <h1 className="text-xl font-bold text-gray-900 dark:text-white mt-2">{project.name}</h1>
                <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
                  {project.district}, {project.state} • {project.constituency || "General Constituency"}
                  {project.mpName && ` • Hon'ble MP: ${project.mpName}`}
                </p>
              </div>

              {/* Risk Indicator & Review Actions */}
              <div className="flex items-center gap-5 shrink-0 flex-wrap sm:flex-nowrap">
                <div className="text-right border-r border-gray-200 pr-5">
                  <p className="text-xs text-gray-400 font-medium">Composite Risk</p>
                  <p className="text-3xl font-bold text-gray-900 leading-none mt-1">
                    {project.riskScore}
                    <span className="text-sm text-gray-400 font-normal"> /100</span>
                  </p>
                  <div className="mt-1">
                    <RiskBadge
                      level={isFalsePositive ? "False Positive" : isConfirmed ? "Reviewed" : project.riskLevel}
                    />
                  </div>
                </div>

                {/* 5. REVIEW ACTIONS: Mark as Reviewed & Mark as False Positive */}
                <div className="flex flex-col sm:flex-row gap-2">
                  <Button
                    variant="secondary"
                    size="sm"
                    icon={<CheckCircle2 size={15} />}
                    onClick={() => setFeedbackModal("confirmed_issue")}
                    disabled={isConfirmed}
                  >
                    {isConfirmed ? "Inspection Requested" : "Send for Inspection"}
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    icon={<ShieldAlert size={15} />}
                    onClick={() => setFeedbackModal("false_positive")}
                    disabled={isFalsePositive}
                  >
                    {isFalsePositive ? "Marked Genuine" : "Mark as Genuine"}
                  </Button>
                </div>
              </div>
            </div>

            {/* Feedback Status Ribbon (if action taken) */}
            {project.feedbackStatus && (
              <div
                className={`p-3 rounded-lg text-xs flex items-center gap-2 border ${
                  isFalsePositive
                    ? "bg-blue-50 border-blue-200 text-blue-800"
                    : "bg-emerald-50 border-emerald-200 text-emerald-800"
                }`}
              >
                <FileCheck size={16} />
                <span>
                  <strong>Officer Review Status: </strong>
                  {isFalsePositive
                    ? "This work was verified as genuine. The automated anomaly was cleared and the persisted risk adjustment was applied (-25 points)."
                    : "This work was confirmed as requiring supervisory inspection. District monitoring team has been notified."}
                </span>
              </div>
            )}
          </div>

          {/* AI / Gemini Explanation Banner */}
          <Card className="p-4 bg-gradient-to-r from-navy-50/50 via-white to-gray-50 border border-navy-100/80">
            <div className="flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-navy-100 text-navy-800 flex items-center justify-center shrink-0 mt-0.5">
                <Sparkles size={16} />
              </div>
              <div className="flex-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold text-navy-900">
                    AI Risk Intelligence & Gemini Analysis
                  </h3>
                  <span className="text-[10px] font-semibold text-navy-700 bg-navy-100/70 px-2 py-0.5 rounded-full">
                    Automated Surveillance Explanation
                  </span>
                </div>
                <p className="text-sm text-gray-700 mt-1.5 leading-relaxed">
                  {project.aiExplanation ||
                    project.flagReason ||
                    "This project was highlighted by the multi-signal AI surveillance engine based on combined cost deviation, semantic scope overlap, and citizen telemetry."}
                </p>
                {project.costZScore && (
                  <p className="text-xs text-navy-800 font-medium mt-1">
                    Cost Anomaly Z-Score: +{Number(project.costZScore).toFixed(2)}σ | Similarity Score: {project.similarityScore ?? 0}%
                  </p>
                )}
              </div>
            </div>
          </Card>

          <Card className={`border ${recommendedAction.tone === "red" ? "border-red-200 bg-red-50/60" : recommendedAction.tone === "amber" ? "border-amber-200 bg-amber-50/60" : "border-blue-200 bg-blue-50/60"}`}>
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-white p-2 text-navy-800 shadow-sm"><recommendedAction.icon size={19} /></div>
              <div className="flex-1">
                <p className="text-[10px] font-extrabold uppercase tracking-wider text-gray-500">Recommended next action</p>
                <h3 className="mt-0.5 text-base font-bold text-gray-900">{recommendedAction.title}</h3>
                <p className="mt-1 text-xs leading-relaxed text-gray-700">{recommendedAction.detail}</p>
                <div className="mt-3 grid grid-cols-1 gap-2 sm:grid-cols-3">
                  <div className={`rounded border p-2 text-[11px] ${!hasTrustedCoordinates ? "border-amber-400 bg-white font-bold" : "border-gray-200 bg-white/70 text-gray-500"}`}><MapPinned size={13} className="mb-1" />Request coordinates</div>
                  <div className={`rounded border p-2 text-[11px] ${hasTrustedCoordinates && ((project.citizenReportCount || 0) > 0 || project.riskScore >= 80 || Math.abs(project.costZScore || 0) >= 3) ? "border-red-400 bg-white font-bold" : "border-gray-200 bg-white/70 text-gray-500"}`}><UserRoundCheck size={13} className="mb-1" />Send field officer</div>
                  <div className={`rounded border p-2 text-[11px] ${hasTrustedCoordinates && (project.citizenReportCount || 0) === 0 && project.riskScore < 80 && Math.abs(project.costZScore || 0) < 3 ? "border-blue-400 bg-white font-bold" : "border-gray-200 bg-white/70 text-gray-500"}`}><Clock3 size={13} className="mb-1" />Recheck in 7 days</div>
                </div>
              </div>
            </div>
          </Card>

          {/* Tabs Navigation */}
          <Tabs tabs={TABS} active={tab} onChange={setTab} />

          {/* Tab Contents */}
          <div className="pt-2">
            {tab === "Overview" && <ProjectOverview project={project} />}
            {tab === "Financial" && <FinancialOverview project={project} />}
            {tab === "Progress" && <ProgressTimeline project={project} />}
            {tab === "AI Analysis" && (
              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                <RiskBreakdown project={project} />
                <SHAPChart factors={project.shapFactors} />
              </div>
            )}
            {tab === "Evidence" && (
              <EvidenceCard
                project={project}
                onViewCitizenTab={() => setTab("Citizen Reports")}
              />
            )}
            {tab === "Citizen Reports" && (
              <ProjectCitizenReports projectId={project.id} />
            )}
          </div>

          {/* Officer Review Feedback Modal */}
          <Modal
            open={!!feedbackModal}
            onClose={() => setFeedbackModal(null)}
            title={
              feedbackModal === "false_positive"
                ? "Mark Project as Genuine"
                : "Send Project for Field Inspection"
            }
          >
            <div className="space-y-4 text-sm text-gray-700">
              <div className="flex items-start gap-2.5 p-3 rounded-lg bg-gray-50 border border-gray-200">
                <AlertCircle size={18} className="text-navy-700 shrink-0 mt-0.5" />
                <p className="text-xs leading-relaxed text-gray-600">
                  {feedbackModal === "false_positive"
                    ? "Marking genuine records that the detected anomaly has a legitimate explanation (for example specialized terrain or verified scope). The risk score will decrease by 25 points across every portal."
                    : "This confirms the anomaly requires field inspection. The decision and updated score will be visible to officers, Super Admin, and citizens viewing this project."}
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-gray-700 mb-1">
                  Officer Verification Notes (Optional)
                </label>
                <textarea
                  className="w-full text-sm border border-gray-300 rounded-lg p-2.5 focus:outline-none focus:ring-2 focus:ring-navy-600"
                  rows={3}
                  placeholder="Enter observation notes, physical inspection date, or reference sanction number..."
                  value={officerNotes}
                  onChange={(e) => setOfficerNotes(e.target.value)}
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-gray-100">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setFeedbackModal(null)}
                  disabled={submittingFeedback}
                >
                  Cancel
                </Button>
                <Button
                  variant="primary"
                  size="sm"
                  onClick={handleConfirmFeedback}
                  disabled={submittingFeedback}
                >
                  {submittingFeedback ? "Submitting..." : "Confirm & Save Verdict"}
                </Button>
              </div>
            </div>
          </Modal>
        </>
      )}
    </div>
  );
}
