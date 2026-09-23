import { useEffect, useState } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { usePortalBase } from "../lib/usePortalBase";
import { ChevronLeft } from "lucide-react";
import Tabs from "../components/ui/Tabs";
import { RiskBadge, StatusBadge } from "../components/ui/Badge";
import { Skeleton, ErrorState } from "../components/ui/Feedback";
import { getProjectById } from "../services/api";
import type { Project } from "../types";
import ProjectOverview from "../components/projectDetails/ProjectOverview";
import FinancialOverview from "../components/projectDetails/FinancialOverview";
import ProgressTimeline from "../components/projectDetails/ProgressTimeline";
import RiskBreakdown from "../components/projectDetails/RiskBreakdown";
import SHAPChart from "../components/projectDetails/SHAPChart";
import EvidenceCard from "../components/projectDetails/EvidenceCard";

const TABS = ["Overview", "Financial", "Progress", "AI Analysis", "Evidence"];

export default function ProjectDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const portalBase = usePortalBase();
  const [project, setProject] = useState<Project | null | undefined>(null);
  const [tab, setTab] = useState("Overview");

  useEffect(() => {
    setProject(null);
    if (id) getProjectById(id).then((p) => setProject(p ?? undefined));
  }, [id]);

  if (project === undefined) {
    return <ErrorState message={`No project found with ID "${id}".`} />;
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <button
        onClick={() => navigate(`${portalBase}/projects`)}
        className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800"
      >
        <ChevronLeft size={16} /> Back to Projects
      </button>

      {!project ? (
        <div className="space-y-4">
          <Skeleton className="h-8 w-1/2" />
          <Skeleton className="h-24 w-full" />
        </div>
      ) : (
        <>
          <div className="bg-white border border-gray-200 rounded-xl p-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div>
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold text-gray-900">{project.name}</h1>
                <StatusBadge status={project.status} />
              </div>
              <p className="text-sm text-gray-500 mt-1">
                {project.id} · {project.district}, {project.state}
              </p>
            </div>
            <div className="flex items-center gap-4 shrink-0">
              <div className="text-right">
                <p className="text-3xl font-bold text-gray-900 leading-none">
                  {project.riskScore}
                  <span className="text-base text-gray-400 font-normal"> /100</span>
                </p>
                <div className="mt-1.5">
                  <RiskBadge level={project.riskLevel} />
                </div>
              </div>
            </div>
          </div>

          <Tabs tabs={TABS} active={tab} onChange={setTab} />

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
            {tab === "Evidence" && <EvidenceCard project={project} />}
          </div>
        </>
      )}
    </div>
  );
}
