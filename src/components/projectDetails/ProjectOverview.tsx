import { MapPin } from "lucide-react";
import Card from "../ui/Card";
import { formatDate } from "../../lib/format";
import type { Project } from "../../types";

export default function ProjectOverview({ project }: { project: Project }) {
  const fields: [string, string][] = [
    ["Work Type", project.workType],
    ["Constituency", project.constituency],
    ["District", project.district],
    ["State", project.state],
    ["Implementing Agency", project.implementingAgency],
    ["Sanction Date", formatDate(project.sanctionDate)],
    ["Expected Completion", formatDate(project.expectedCompletion)],
    ["Current Status", project.status],
    ["Physical Progress", `${project.physicalProgress}%`],
  ];

  return (
    <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
      <Card className="lg:col-span-2">
        <h3 className="font-semibold text-gray-900 mb-4">Project Information</h3>
        <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
          {fields.map(([label, value]) => (
            <div key={label}>
              <dt className="text-xs text-gray-400">{label}</dt>
              <dd className="text-sm font-medium text-gray-800 mt-0.5">{value}</dd>
            </div>
          ))}
        </dl>
      </Card>
      <Card>
        <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
          <MapPin size={15} /> Project Location
        </h3>
        <div className="aspect-square bg-gray-100 rounded-lg flex flex-col items-center justify-center text-gray-400 text-xs gap-1">
          <MapPin size={22} />
          <span>
            {project.latitude.toFixed(3)}, {project.longitude.toFixed(3)}
          </span>
          <span className="text-[10px]">{project.district}, {project.state}</span>
        </div>
      </Card>
    </div>
  );
}
