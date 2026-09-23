import { useNavigate } from "react-router-dom";
import { MapPin, ArrowRight } from "lucide-react";
import { StatusBadge } from "../ui/Badge";
import { formatINR } from "../../lib/format";
import type { Project } from "../../types";

export default function CitizenProjectCard({ project }: { project: Project }) {
  const navigate = useNavigate();
  return (
    <button
      onClick={() => navigate(`/citizen/project/${project.id}`)}
      className="w-full text-left bg-white rounded-xl border border-gray-200 shadow-card p-4 hover:border-navy-300 hover:shadow-md transition-all"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="font-semibold text-gray-900 truncate">{project.name}</p>
          <p className="text-xs text-gray-400 mt-0.5 flex items-center gap-1">
            <MapPin size={11} /> {project.district}, {project.state}
          </p>
        </div>
        <StatusBadge status={project.status} />
      </div>
      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-50">
        <div className="text-xs text-gray-500">
          <span className="font-medium text-gray-700">{project.id}</span> · Sanctioned {formatINR(project.sanctionedAmount)}
        </div>
        <span className="text-xs font-medium text-navy-700 flex items-center gap-0.5">
          View <ArrowRight size={12} />
        </span>
      </div>
    </button>
  );
}
