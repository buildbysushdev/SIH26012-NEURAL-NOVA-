import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search as SearchIcon, Camera } from "lucide-react";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { StatusBadge } from "../../components/ui/Badge";
import { EmptyState, Skeleton } from "../../components/ui/Feedback";
import { getCitizenReports } from "../../services/api";
import { formatDate } from "../../lib/format";
import type { CitizenReport } from "../../types";

const ISSUE_TYPES = [
  "Work not started",
  "Work incomplete",
  "Poor quality",
  "Project not found",
  "Possible duplicate work",
  "Other",
];

export default function AdminCitizenReports() {
  const navigate = useNavigate();
  const [reports, setReports] = useState<CitizenReport[] | null>(null);
  const [search, setSearch] = useState("");
  const [issueFilter, setIssueFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");

  useEffect(() => {
    getCitizenReports().then(setReports);
  }, []);

  const filtered = reports?.filter((r) => {
    const matchesSearch =
      !search ||
      r.projectId.toLowerCase().includes(search.toLowerCase()) ||
      r.projectName.toLowerCase().includes(search.toLowerCase()) ||
      r.id.toLowerCase().includes(search.toLowerCase());
    const matchesIssue = !issueFilter || r.issueType === issueFilter;
    const matchesStatus = !statusFilter || r.status === statusFilter;
    return matchesSearch && matchesIssue && matchesStatus;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <h2 className="text-xl font-bold text-gray-900">Citizen Reports</h2>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <Input
              placeholder="Search report ID, project..."
              icon={<SearchIcon size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            placeholder="All Issue Types"
            options={ISSUE_TYPES.map((i) => ({ value: i, label: i }))}
            value={issueFilter}
            onChange={(e) => setIssueFilter(e.target.value)}
          />
          <Select
            placeholder="All Status"
            options={["Received", "Under Review", "Resolved"].map((s) => ({ value: s, label: s }))}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          />
        </div>
      </Card>

      <Card noPadding className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[820px]">
            <thead>
              <tr className="text-left text-gray-400 text-xs border-b border-gray-100 bg-gray-50/50">
                <th className="py-3 px-4 font-medium">Report ID</th>
                <th className="py-3 px-3 font-medium">Project</th>
                <th className="py-3 px-3 font-medium">Location</th>
                <th className="py-3 px-3 font-medium">Issue Type</th>
                <th className="py-3 px-3 font-medium">Submitted</th>
                <th className="py-3 px-3 font-medium">Status</th>
                <th className="py-3 px-4 font-medium text-right">Action</th>
              </tr>
            </thead>
            <tbody>
              {!filtered &&
                Array.from({ length: 6 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td colSpan={7} className="py-3 px-4">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))}
              {filtered?.map((r) => (
                <tr key={r.id} className="border-b border-gray-50 hover:bg-gray-50 last:border-0">
                  <td className="py-3 px-4 font-medium text-navy-800 whitespace-nowrap">{r.id}</td>
                  <td className="py-3 px-3 text-gray-700 max-w-[200px] truncate">
                    {r.projectId} — {r.projectName}
                  </td>
                  <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{r.location}</td>
                  <td className="py-3 px-3 text-gray-600 whitespace-nowrap flex items-center gap-1.5">
                    {r.issueType} {r.hasPhoto && <Camera size={12} className="text-gray-400" />}
                  </td>
                  <td className="py-3 px-3 text-gray-500 whitespace-nowrap">{formatDate(r.submittedDate)}</td>
                  <td className="py-3 px-3"><StatusBadge status={r.status} /></td>
                  <td className="py-3 px-4 text-right">
                    <button
                      onClick={() => navigate(`/admin/projects/${r.projectId}`)}
                      className="text-xs font-medium text-navy-700 hover:underline"
                    >
                      View Project
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered && filtered.length === 0 && (
          <EmptyState title="No citizen reports found" description="Try a different search term or filter." />
        )}
      </Card>
    </div>
  );
}
