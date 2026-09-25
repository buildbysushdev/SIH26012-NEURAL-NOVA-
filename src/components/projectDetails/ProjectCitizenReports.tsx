import { useEffect, useState } from "react";
import { MessageSquareWarning, Camera, MapPin, Calendar, CheckCircle } from "lucide-react";
import Card from "../ui/Card";
import { StatusBadge } from "../ui/Badge";
import { EmptyState, Skeleton } from "../ui/Feedback";
import { formatDate } from "../../lib/format";
import { getCitizenReportsForProject } from "../../services/api";
import type { CitizenReport } from "../../types";

export default function ProjectCitizenReports({ projectId }: { projectId: string }) {
  const [reports, setReports] = useState<CitizenReport[] | null>(null);

  useEffect(() => {
    setReports(null);
    getCitizenReportsForProject(projectId).then(setReports);
  }, [projectId]);

  if (!reports) {
    return (
      <Card>
        <div className="space-y-3">
          <Skeleton className="h-6 w-1/3" />
          <Skeleton className="h-20 w-full" />
          <Skeleton className="h-20 w-full" />
        </div>
      </Card>
    );
  }

  if (reports.length === 0) {
    return (
      <Card>
        <EmptyState
          title="No Citizen Reports Found"
          description={`No citizen feedback or on-site reports have been submitted for Work ID ${projectId}.`}
        />
      </Card>
    );
  }

  return (
    <Card>
      <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
        <div>
          <h3 className="font-semibold text-gray-900">Citizen Reports ({reports.length})</h3>
          <p className="text-xs text-gray-500">
            Field feedback submitted by local citizens and community monitors
          </p>
        </div>
        <span className="text-xs font-semibold px-2.5 py-1 bg-amber-50 text-amber-800 rounded-full border border-amber-200">
          Citizen Signal Active
        </span>
      </div>

      <div className="space-y-4">
        {reports.map((report) => (
          <div
            key={report.id}
            className="border border-gray-200 rounded-lg p-4 bg-white hover:bg-gray-50/50 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-700 flex items-center justify-center shrink-0">
                  <MessageSquareWarning size={16} />
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono text-xs font-semibold text-gray-800">
                      {report.id}
                    </span>
                    <span className="text-xs font-medium text-gray-600 bg-gray-100 px-2 py-0.5 rounded">
                      {report.issueType}
                    </span>
                  </div>
                  <p className="text-xs text-gray-500 flex items-center gap-2 mt-0.5">
                    <span className="flex items-center gap-1">
                      <MapPin size={11} /> {report.location}
                    </span>
                    <span>•</span>
                    <span className="flex items-center gap-1">
                      <Calendar size={11} /> {formatDate(report.submittedDate)}
                    </span>
                  </p>
                </div>
              </div>
              <StatusBadge status={report.status} />
            </div>

            <p className="text-sm text-gray-700 mt-3 bg-gray-50 p-3 rounded-md border border-gray-100 leading-relaxed">
              "{report.description}"
            </p>

            <div className="flex items-center justify-between mt-3 text-xs text-gray-500">
              <div className="flex items-center gap-3">
                {report.hasPhoto ? (
                  <span className="inline-flex items-center gap-1 text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded font-medium">
                    <Camera size={12} /> Geotagged Photo Attached
                  </span>
                ) : (
                  <span className="text-gray-400">No media attached</span>
                )}
                <span className="inline-flex items-center gap-1 text-navy-700 bg-navy-50 px-2 py-0.5 rounded font-medium">
                  <CheckCircle size={12} /> GPS Hash Locked
                </span>
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
