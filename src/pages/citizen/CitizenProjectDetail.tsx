import { useEffect, useState } from "react";
import { useParams, useNavigate, Link } from "react-router-dom";
import { ChevronLeft, MapPin, Calendar, Wallet, AlertCircle, Satellite, ShieldCheck } from "lucide-react";
import { StatusBadge } from "../../components/ui/Badge";
import { Skeleton, ErrorState } from "../../components/ui/Feedback";
import { getProjectById, getSatelliteImageUrl } from "../../services/api";
import { formatDate, formatINR } from "../../lib/format";
import type { Project } from "../../types";
import CitizenTimeline from "../../components/citizen/CitizenTimeline";

export default function CitizenProjectDetail() {
  const params = useParams();
  const rawId = params["*"] || params.id || "";
  const id = rawId ? decodeURIComponent(rawId).trim() : "";
  const navigate = useNavigate();
  const [project, setProject] = useState<Project | null | undefined>(null);

  useEffect(() => {
    setProject(null);
    if (id) getProjectById(id).then((p) => setProject(p ?? undefined));
  }, [id]);

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <button onClick={() => navigate(-1)} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800 mb-5">
        <ChevronLeft size={16} /> Back
      </button>

      {project === null && (
        <div className="space-y-4">
          <Skeleton className="h-8 w-2/3" />
          <Skeleton className="h-40 w-full rounded-xl" />
        </div>
      )}

      {project === undefined && (
        <ErrorState message={`No public project found with ID "${id}". Please check the project ID and try again.`} />
      )}

      {project && (
        <div className="animate-fade-in space-y-6">
          <div>
            <div className="flex items-center gap-2 flex-wrap mb-1">
              <h1 className="text-2xl font-bold text-gray-900">{project.name}</h1>
              <StatusBadge status={project.status} />
            </div>
            <p className="text-sm text-gray-500 flex items-center gap-1">
              <MapPin size={13} /> {project.district}, {project.state} · {project.id}
            </p>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: "Sanctioned Amount", value: formatINR(project.sanctionedAmount), icon: Wallet },
              { label: "Expected Completion", value: formatDate(project.expectedCompletion), icon: Calendar },
              { label: "Progress", value: `${project.physicalProgress}%`, icon: AlertCircle },
              { label: "Category", value: project.category, icon: MapPin },
            ].map((k) => (
              <div key={k.label} className="bg-white border border-gray-200 rounded-xl p-4">
                <k.icon size={16} className="text-navy-600 mb-2" />
                <p className="text-sm font-bold text-gray-900">{k.value}</p>
                <p className="text-[11px] text-gray-400 mt-0.5">{k.label}</p>
              </div>
            ))}
          </div>

          <div className={`rounded-xl border p-4 ${project.feedbackStatus === "false_positive" ? "border-emerald-200 bg-emerald-50" : project.feedbackStatus === "confirmed_issue" ? "border-red-200 bg-red-50" : "border-amber-200 bg-amber-50"}`}>
            <div className="flex items-start gap-2">
              <ShieldCheck size={18} className={project.feedbackStatus === "false_positive" ? "text-emerald-700" : project.feedbackStatus === "confirmed_issue" ? "text-red-700" : "text-amber-700"} />
              <div>
                <p className="text-sm font-bold text-gray-900">{project.feedbackStatus === "false_positive" ? "Officer verified this work as genuine" : project.feedbackStatus === "confirmed_issue" ? "Field inspection has been requested" : "Automated anomaly is awaiting officer review"}</p>
                <p className="mt-1 text-xs text-gray-600">This status comes from the same live project record used by the Officer and Super Admin portals. Citizen reports submitted here are visible to both teams.</p>
              </div>
            </div>
          </div>

          {project.latitude !== 0 && project.longitude !== 0 && (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white">
              <div className="flex items-center justify-between border-b border-gray-100 px-4 py-3">
                <div><h3 className="flex items-center gap-2 text-sm font-semibold text-gray-900"><Satellite size={16} /> Site reference imagery</h3><p className="text-[11px] text-gray-500">Esri World Imagery · geographic reference only · manual review required</p></div>
                <span className="font-mono text-[10px] text-gray-500">{project.latitude.toFixed(5)}, {project.longitude.toFixed(5)}</span>
              </div>
              <img src={getSatelliteImageUrl(project.id)} alt="Project site reference" className="h-64 w-full object-cover" />
            </div>
          )}

          <div className="bg-white border border-gray-200 rounded-xl p-5">
            <h3 className="font-semibold text-gray-900 mb-4">Project Timeline</h3>
            <CitizenTimeline project={project} />
          </div>

          <div className="bg-navy-50 border border-navy-100 rounded-xl p-5 text-center">
            <p className="text-sm text-navy-800 mb-3">Noticed something wrong with this project?</p>
            <Link
              to={`/citizen/report?projectId=${project.id}`}
              className="inline-block bg-navy-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-navy-700"
            >
              Report an Issue About This Project
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
