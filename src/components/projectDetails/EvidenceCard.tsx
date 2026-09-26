import { useState } from "react";
import {
  Satellite,
  FileText,
  GitCompareArrows,
  MessageSquareWarning,
  MapPin,
  Download,
  CheckCircle,
} from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import type { Project } from "../../types";
import { formatINR } from "../../lib/format";
import { useToast } from "../../context/ToastContext";
import { getSatelliteImageUrl, getAuditBriefPdfUrl } from "../../services/api";

const ICONS: Record<string, any> = {
  Financial: FileText,
  Satellite: Satellite,
  NLP: GitCompareArrows,
  Citizen: MessageSquareWarning,
  Location: MapPin,
};

export default function EvidenceCard({
  project,
  onViewCitizenTab,
}: {
  project: Project;
  onViewCitizenTab?: () => void;
}) {
  const [modal, setModal] = useState<string | null>(null);
  const { showToast } = useToast();

  const deviationPct = Math.round(
    ((project.expenditure - project.peerAverageCost) / project.peerAverageCost) * 100
  );

  const evidence = [
    {
      key: "Financial",
      title: "Cost Anomaly Evidence",
      badge: project.costZScore ? `Z-Score +${Number(project.costZScore).toFixed(2)}` : `${deviationPct >= 0 ? "+" : ""}${deviationPct}%`,
      text: project.costZScore
        ? `Statistical cost deviation of Z-Score +${Number(project.costZScore).toFixed(2)} detected compared against peer works in ${project.state}.`
        : `Current expenditure is ${Math.max(deviationPct, 0)}% above peer average for similar works in ${project.category}.`,
      action: "Inspect Cost Breakdown",
    },
    {
      key: "NLP",
      title: "Duplicate & Ghost Work Detection",
      badge: project.similarityScore ? `${project.similarityScore}% Overlap` : "Low Overlap",
      text: project.similarProjectId
        ? `${project.similarityScore}% semantic similarity identified with project ${project.similarProjectId}${
            project.similarState ? ` in ${project.similarState}` : ""
          }.`
        : "No duplicate description or scope overlap detected above the 70% threshold.",
      action: "View Semantic Match",
    },
    {
      key: "Satellite",
      title: "Satellite Physical Verification",
      badge: project.satelliteStatus || (project.riskFactors.satelliteVerification === "Review" ? "Verification Advised" : "Normal"),
      text: project.satelliteStatus
        ? `Optical & radar analysis: ${project.satelliteStatus}.${
            project.satelliteRiskScore ? ` Anomaly score: ${project.satelliteRiskScore}/100.` : ""
          }`
        : project.riskFactors.satelliteVerification === "Review"
        ? "Physical inspection recommended based on historical ground progress imagery."
        : "Imagery analysis indicates ground activity consistent with reported physical progress.",
      action: "View Satellite Telemetry",
    },
    {
      key: "Citizen",
      title: "Citizen Feedback & Reports",
      badge:
        project.citizenReportCount !== undefined
          ? `${project.citizenReportCount} Report(s)`
          : project.riskFactors.citizenSignal === "Low"
          ? "0-1 Report"
          : "Multiple Reports",
      text:
        project.citizenReportCount !== undefined
          ? `${project.citizenReportCount} verified citizen observation(s) submitted for this location.`
          : `${project.riskFactors.citizenSignal === "Low" ? "Minimal" : "Elevated"} citizen grievance reports recorded for this work.`,
      action: "View Citizen Evidence",
    },
  ];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100 flex-wrap gap-2">
        <div>
          <h3 className="font-semibold text-gray-900">Multi-Signal Evidence Summary</h3>
          <p className="text-xs text-gray-500">
            Supervisory evidence compiled by AI anomaly models and verified field inputs
          </p>
        </div>
        <Button
          variant="outline"
          size="sm"
          icon={<Download size={14} />}
          onClick={() => {
            const url = getAuditBriefPdfUrl(project.id);
            window.open(url, "_blank");
            showToast("Opening official AI Audit Dossier PDF...", "info");
          }}
        >
          Download Evidence Dossier
        </Button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {evidence.map((e) => {
          const Icon = ICONS[e.key];
          return (
            <div
              key={e.key}
              className="border border-gray-200 rounded-lg p-4 bg-white hover:border-gray-300 transition-colors flex flex-col justify-between"
            >
              <div>
                <div className="flex items-center justify-between gap-2 mb-2">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 rounded-md bg-navy-50 text-navy-700 flex items-center justify-center shrink-0">
                      <Icon size={16} />
                    </div>
                    <p className="text-sm font-semibold text-gray-800">{e.title}</p>
                  </div>
                  <span className="text-[11px] font-semibold px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                    {e.badge}
                  </span>
                </div>
                <p className="text-xs text-gray-600 leading-relaxed mb-4">{e.text}</p>
              </div>

              <div>
                <button
                  onClick={() => {
                    if (e.key === "Citizen" && onViewCitizenTab) {
                      onViewCitizenTab();
                    } else {
                      setModal(e.key);
                    }
                  }}
                  className="text-xs font-semibold text-navy-700 hover:text-navy-900 hover:underline inline-flex items-center gap-1"
                >
                  {e.action} →
                </button>
              </div>
            </div>
          );
        })}
      </div>

      {/* Detail Modals for Evidence */}
      <Modal
        open={!!modal}
        onClose={() => setModal(null)}
        title={evidence.find((e) => e.key === modal)?.title}
      >
        {modal === "Financial" && (
          <div className="space-y-4 text-sm text-gray-700">
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
              <div className="flex justify-between">
                <span className="text-gray-500">Peer Average Cost:</span>
                <span className="font-semibold text-gray-900">{formatINR(project.peerAverageCost)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Current Expenditure:</span>
                <span className="font-semibold text-gray-900">{formatINR(project.expenditure)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-500">Sanctioned Amount:</span>
                <span className="font-semibold text-gray-900">{formatINR(project.sanctionedAmount)}</span>
              </div>
              <div className="flex justify-between border-t border-gray-200 pt-2">
                <span className="text-gray-700 font-medium">Deviation Envelope:</span>
                <span className="font-bold text-red-600">
                  {deviationPct >= 0 ? "+" : ""}{deviationPct}%
                </span>
              </div>
              {project.costZScore && (
                <div className="flex justify-between">
                  <span className="text-gray-700 font-medium">Statistical Z-Score:</span>
                  <span className="font-mono font-bold text-red-700">+{Number(project.costZScore).toFixed(2)}σ</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Note: Cost anomaly is a statistical signal comparing this work's unit rate against similar approved works in the same district and work category.
            </p>
          </div>
        )}

        {modal === "NLP" && (
          <div className="text-sm text-gray-700 space-y-3">
            {project.similarProjectId ? (
              <>
                <p>
                  Sentence-BERT semantic embedding detected a{" "}
                  <span className="font-bold text-red-600">{project.similarityScore}%</span> similarity
                  with a previously sanctioned project:
                </p>
                <div className="bg-navy-50/60 p-3 rounded-lg border border-navy-100 space-y-1">
                  <p className="text-xs text-gray-500">Matched Record Work ID:</p>
                  <p className="font-mono font-bold text-navy-900">{project.similarProjectId}</p>
                  {project.similarProjectName && (
                    <p className="text-xs text-gray-700 mt-1">"{project.similarProjectName}"</p>
                  )}
                  {project.similarState && (
                    <p className="text-xs text-gray-500 mt-0.5">Jurisdiction: {project.similarState}</p>
                  )}
                </div>
                <p className="text-xs text-gray-500">
                  Supervisory action: Check if this work duplicates scope, materials, or locations funded under previous sanctions.
                </p>
              </>
            ) : (
              <div className="text-center py-4">
                <CheckCircle size={28} className="text-emerald-600 mx-auto mb-2" />
                <p className="font-medium text-gray-800">No High Semantic Similarity Detected</p>
                <p className="text-xs text-gray-500 mt-1">
                  NLP embedding model found no overlapping works exceeding the alert threshold.
                </p>
              </div>
            )}
          </div>
        )}

        {modal === "Satellite" && (
          <div className="text-sm text-gray-700 space-y-3">
            <div className="relative aspect-video bg-gray-900 rounded-lg overflow-hidden flex flex-col items-center justify-center text-gray-300 text-xs">
              <img
                src={getSatelliteImageUrl(project.id)}
                alt={`Satellite image for ${project.id}`}
                className="w-full h-full object-cover"
                onError={(e) => {
                  (e.currentTarget as HTMLElement).style.display = "none";
                }}
              />
              <div className="absolute bottom-2 left-2 right-2 bg-navy-950/80 backdrop-blur-sm px-3 py-1.5 rounded text-[11px] text-gray-200 flex items-center justify-between">
                <span className="font-mono">
                  {project.latitude.toFixed(4)}° N, {project.longitude.toFixed(4)}° E
                </span>
                <span className="text-emerald-400 font-medium">Esri World Imagery · Reference</span>
              </div>
            </div>
            <div className="p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-gray-500 text-xs">Imagery Analysis Status:</span>
                <span className="font-semibold text-gray-900 text-xs">
                  {project.satelliteStatus || (project.riskFactors.satelliteVerification === "Review" ? "Physical Verification Recommended" : "Manual review required")}
                </span>
              </div>
              {project.satelliteRiskScore !== undefined && (
                <div className="flex justify-between">
                  <span className="text-gray-500 text-xs">Satellite Anomaly Score:</span>
                  <span className="font-semibold text-amber-700 text-xs">{project.satelliteRiskScore} / 100</span>
                </div>
              )}
            </div>
            <p className="text-xs text-gray-500">
              Reference basemap imagery centered on the available coordinates. No automated structure verdict is inferred from this image.
            </p>
          </div>
        )}

        {modal === "Citizen" && (
          <div className="space-y-3">
            <p className="text-sm text-gray-700">
              Citizen reports for this project can be reviewed under the dedicated{" "}
              <span className="font-semibold">Citizen Reports</span> tab.
            </p>
            {onViewCitizenTab && (
              <Button
                variant="primary"
                size="sm"
                onClick={() => {
                  setModal(null);
                  onViewCitizenTab();
                }}
              >
                Go to Citizen Reports Tab
              </Button>
            )}
          </div>
        )}
      </Modal>
    </Card>
  );
}
