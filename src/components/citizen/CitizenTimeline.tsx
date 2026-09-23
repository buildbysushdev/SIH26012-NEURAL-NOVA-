import { CheckCircle2, Circle } from "lucide-react";
import type { Project } from "../../types";
import { formatDate } from "../../lib/format";

export default function CitizenTimeline({ project }: { project: Project }) {
  const stages = [
    { label: "Sanctioned", done: true, date: formatDate(project.sanctionDate) },
    { label: "Funds Released", done: project.releasedAmount > 0, date: project.releasedAmount > 0 ? formatDate(project.sanctionDate) : "Pending" },
    { label: "Work Started", done: project.physicalProgress > 0, date: project.physicalProgress > 0 ? "In progress" : "Not yet started" },
    { label: "Under Construction", done: project.physicalProgress > 10 && project.status !== "Completed", date: `${project.physicalProgress}% complete` },
    { label: "Completed", done: project.status === "Completed", date: project.status === "Completed" ? formatDate(project.expectedCompletion) : "Pending" },
  ];

  return (
    <div className="space-y-0">
      {stages.map((s, i) => (
        <div key={s.label} className="flex gap-3">
          <div className="flex flex-col items-center">
            {s.done ? <CheckCircle2 size={20} className="text-emerald-600" /> : <Circle size={20} className="text-gray-300" />}
            {i < stages.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
          </div>
          <div className="pb-6">
            <p className={`text-sm font-medium ${s.done ? "text-gray-800" : "text-gray-400"}`}>{s.label}</p>
            <p className="text-xs text-gray-400 mt-0.5">{s.date}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
