import { useState } from "react";
import { Satellite, FileText, GitCompareArrows, MessageSquareWarning, MapPin, Download } from "lucide-react";
import Card from "../ui/Card";
import Button from "../ui/Button";
import Modal from "../ui/Modal";
import type { Project } from "../../types";
import { formatINR } from "../../lib/format";
import { useToast } from "../../context/ToastContext";

const ICONS: Record<string, any> = {
  Financial: FileText,
  Satellite: Satellite,
  NLP: GitCompareArrows,
  Citizen: MessageSquareWarning,
  Location: MapPin,
};

export default function EvidenceCard({ project }: { project: Project }) {
  const [modal, setModal] = useState<string | null>(null);
  const { showToast } = useToast();

  const deviationPct = Math.round(((project.expenditure - project.peerAverageCost) / project.peerAverageCost) * 100);

  const evidence = [
    {
      key: "Financial",
      title: "Financial Evidence",
      text: `Current expenditure is ${Math.max(deviationPct, 0)}% above peer average for similar works.`,
      action: "View Timeline",
    },
    {
      key: "NLP",
      title: "NLP Similarity Evidence",
      text: project.similarProjectId
        ? `${project.similarityScore}% semantic similarity with Project ${project.similarProjectId}.`
        : "No significant duplicate similarity detected for this project.",
      action: "View Similar Project",
    },
    {
      key: "Satellite",
      title: "Satellite Evidence",
      text:
        project.riskFactors.satelliteVerification === "Review"
          ? "Physical verification recommended based on imagery analysis."
          : "Imagery analysis shows activity consistent with reported progress.",
      action: "View Satellite Evidence",
    },
    {
      key: "Citizen",
      title: "Citizen Evidence",
      text: `${project.riskFactors.citizenSignal === "Low" ? "0-1" : "2-4"} citizen report(s) associated with this project.`,
      action: "View Citizen Reports",
    },
  ];

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <h3 className="font-semibold text-gray-900">Evidence Summary</h3>
        <Button
          variant="outline"
          size="sm"
          icon={<Download size={14} />}
          onClick={() => showToast("Evidence report download started (mock).", "info")}
        >
          Download Evidence Report
        </Button>
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {evidence.map((e) => {
          const Icon = ICONS[e.key];
          return (
            <div key={e.key} className="border border-gray-200 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <div className="w-7 h-7 rounded-md bg-navy-50 text-navy-700 flex items-center justify-center">
                  <Icon size={14} />
                </div>
                <p className="text-sm font-semibold text-gray-800">{e.title}</p>
              </div>
              <p className="text-xs text-gray-500 leading-relaxed mb-3">{e.text}</p>
              <button onClick={() => setModal(e.key)} className="text-xs font-medium text-navy-700 hover:underline">
                {e.action}
              </button>
            </div>
          );
        })}
      </div>

      <Modal open={!!modal} onClose={() => setModal(null)} title={evidence.find((e) => e.key === modal)?.title}>
        {modal === "Financial" && (
          <div className="space-y-3 text-sm text-gray-700">
            <div className="flex justify-between"><span>Peer Average Cost</span><span className="font-semibold">{formatINR(project.peerAverageCost)}</span></div>
            <div className="flex justify-between"><span>Current Expenditure</span><span className="font-semibold">{formatINR(project.expenditure)}</span></div>
            <div className="flex justify-between"><span>Deviation</span><span className="font-semibold text-orange-600">{deviationPct >= 0 ? "+" : ""}{deviationPct}%</span></div>
          </div>
        )}
        {modal === "NLP" && (
          <div className="text-sm text-gray-700 space-y-2">
            {project.similarProjectId ? (
              <>
                <p>This project shows a <span className="font-semibold">{project.similarityScore}%</span> semantic similarity score with:</p>
                <p className="font-mono text-navy-700 bg-navy-50 px-3 py-2 rounded-lg">{project.similarProjectId}</p>
                <p className="text-xs text-gray-500">Similarity is computed via Sentence-BERT embeddings comparing work descriptions, scope, and location metadata (mock data).</p>
              </>
            ) : (
              <p>No project above the similarity threshold was found for this record.</p>
            )}
          </div>
        )}
        {modal === "Satellite" && (
          <div className="text-sm text-gray-700 space-y-3">
            <div className="aspect-video bg-gray-100 rounded-lg flex items-center justify-center text-gray-400 text-xs">
              Satellite imagery preview (mock placeholder)
            </div>
            <p>{project.riskFactors.satelliteVerification === "Review" ? "Imagery-based signal suggests scheduling a physical verification visit." : "No verification concern flagged from available imagery."}</p>
          </div>
        )}
        {modal === "Citizen" && (
          <p className="text-sm text-gray-700">
            {project.riskFactors.citizenSignal === "Low"
              ? "Minimal citizen feedback recorded for this project."
              : "Multiple citizen reports have been received. Review the Alerts page for full report details."}
          </p>
        )}
      </Modal>
    </Card>
  );
}
