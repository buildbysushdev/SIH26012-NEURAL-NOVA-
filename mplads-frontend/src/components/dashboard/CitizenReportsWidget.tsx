import { MessageSquareWarning, Camera } from "lucide-react";
import Card from "../ui/Card";
import { StatusBadge } from "../ui/Badge";
import { formatDate } from "../../lib/format";
import type { CitizenReport } from "../../types";

export default function CitizenReportsWidget({ reports }: { reports: CitizenReport[] }) {
  return (
    <Card>
      <h3 className="font-semibold text-gray-900 mb-1">Recent Citizen Reports</h3>
      <p className="text-xs text-gray-500 mb-4">Latest issues flagged by the public</p>
      <div className="space-y-3">
        {reports.map((r) => (
          <div key={r.id} className="flex items-start gap-3 pb-3 border-b border-gray-50 last:border-0 last:pb-0">
            <div className="w-8 h-8 rounded-lg bg-amber-50 text-amber-600 flex items-center justify-center shrink-0">
              <MessageSquareWarning size={15} />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center justify-between gap-2">
                <p className="text-sm font-medium text-gray-800 truncate">{r.issueType}</p>
                <StatusBadge status={r.status} />
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                {r.projectId} • {r.location}
              </p>
              <div className="flex items-center gap-2 mt-1 text-[11px] text-gray-400">
                <span>{formatDate(r.submittedDate)}</span>
                {r.hasPhoto && (
                  <span className="flex items-center gap-0.5">
                    <Camera size={11} /> Photo attached
                  </span>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}
