import { useEffect, useState } from "react";
import { Search as SearchIcon, ScrollText } from "lucide-react";
import Card from "../../components/ui/Card";
import Input from "../../components/ui/Input";
import Select from "../../components/ui/Select";
import { EmptyState, Skeleton } from "../../components/ui/Feedback";
import { getAuditLogs } from "../../services/api";
import type { AuditLogEntry } from "../../types";

const ACTION_OPTIONS = [
  "Login",
  "Logout",
  "Alert Resolved",
  "Alert Assigned",
  "Alert Under Review",
  "Report Generated",
  "Officer Added",
  "Officer Deactivated",
  "Officer Activated",
  "Settings Updated",
  "Citizen Report Reviewed",
];

export default function AuditLogs() {
  const [logs, setLogs] = useState<AuditLogEntry[] | null>(null);
  const [search, setSearch] = useState("");
  const [actionFilter, setActionFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  useEffect(() => {
    getAuditLogs().then(setLogs);
  }, []);

  const filtered = logs?.filter((l) => {
    const matchesSearch =
      !search ||
      l.actor.toLowerCase().includes(search.toLowerCase()) ||
      l.target.toLowerCase().includes(search.toLowerCase()) ||
      l.id.toLowerCase().includes(search.toLowerCase());
    const matchesAction = !actionFilter || l.action === actionFilter;
    const matchesRole = !roleFilter || l.actorRole === roleFilter;
    return matchesSearch && matchesAction && matchesRole;
  });

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center gap-2">
        <ScrollText size={20} className="text-navy-700" />
        <h2 className="text-xl font-bold text-gray-900">Audit & Activity Logs</h2>
      </div>

      <Card>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="sm:col-span-1">
            <Input
              placeholder="Search actor, target, log ID..."
              icon={<SearchIcon size={16} />}
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>
          <Select
            placeholder="All Actions"
            options={ACTION_OPTIONS.map((a) => ({ value: a, label: a }))}
            value={actionFilter}
            onChange={(e) => setActionFilter(e.target.value)}
          />
          <Select
            placeholder="All Roles"
            options={[{ value: "Officer", label: "Officer" }, { value: "Super Admin", label: "Super Admin" }]}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          />
        </div>
      </Card>

      <Card noPadding className="overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm min-w-[760px]">
            <thead>
              <tr className="text-left text-gray-400 text-xs border-b border-gray-100 bg-gray-50/50">
                <th className="py-3 px-4 font-medium">Log ID</th>
                <th className="py-3 px-3 font-medium">Actor</th>
                <th className="py-3 px-3 font-medium">Role</th>
                <th className="py-3 px-3 font-medium">Action</th>
                <th className="py-3 px-3 font-medium">Target</th>
                <th className="py-3 px-3 font-medium">Timestamp</th>
                <th className="py-3 px-4 font-medium">IP Address</th>
              </tr>
            </thead>
            <tbody>
              {!filtered &&
                Array.from({ length: 8 }).map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td colSpan={7} className="py-3 px-4">
                      <Skeleton className="h-5 w-full" />
                    </td>
                  </tr>
                ))}
              {filtered?.map((l) => (
                <tr key={l.id} className="border-b border-gray-50 hover:bg-gray-50 last:border-0">
                  <td className="py-2.5 px-4 font-mono text-xs text-gray-500 whitespace-nowrap">{l.id}</td>
                  <td className="py-2.5 px-3 font-medium text-gray-800 whitespace-nowrap">{l.actor}</td>
                  <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{l.actorRole}</td>
                  <td className="py-2.5 px-3 text-gray-700 whitespace-nowrap">{l.action}</td>
                  <td className="py-2.5 px-3 text-gray-500 max-w-[180px] truncate">{l.target}</td>
                  <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{l.timestamp.replace("T", " ")}</td>
                  <td className="py-2.5 px-4 font-mono text-xs text-gray-400 whitespace-nowrap">{l.ipAddress}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {filtered && filtered.length === 0 && (
          <EmptyState title="No log entries found" description="Try a different search term or filter." />
        )}
      </Card>
    </div>
  );
}
