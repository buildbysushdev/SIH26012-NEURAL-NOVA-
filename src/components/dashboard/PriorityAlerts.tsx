import { useNavigate } from "react-router-dom";
import { usePortalBase } from "../../lib/usePortalBase";
import Card from "../ui/Card";
import { RiskBadge } from "../ui/Badge";
import { formatDate } from "../../lib/format";
import type { RiskAlert } from "../../types";

export default function PriorityAlerts({ alerts }: { alerts: RiskAlert[] }) {
  const navigate = useNavigate();
  const portalBase = usePortalBase();

  return (
    <Card noPadding className="overflow-hidden">
      <div className="p-5 pb-3 flex items-center justify-between">
        <div>
          <h3 className="font-semibold text-gray-900">High Priority Alerts</h3>
          <p className="text-xs text-gray-500 mt-0.5">Highest risk-scoring open items</p>
        </div>
        <button onClick={() => navigate(`${portalBase}/alerts`)} className="text-xs font-medium text-navy-700 hover:underline">
          View all
        </button>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="text-left text-gray-400 text-xs border-y border-gray-100">
              <th className="py-2.5 px-5 font-medium">Project ID</th>
              <th className="py-2.5 px-3 font-medium">Project</th>
              <th className="py-2.5 px-3 font-medium">Location</th>
              <th className="py-2.5 px-3 font-medium">Risk Score</th>
              <th className="py-2.5 px-3 font-medium">Issue</th>
              <th className="py-2.5 px-3 font-medium">Detected</th>
              <th className="py-2.5 px-5 font-medium text-right">Action</th>
            </tr>
          </thead>
          <tbody>
            {alerts.map((a) => (
              <tr key={a.id} className="border-b border-gray-50 hover:bg-gray-50 last:border-0">
                <td className="py-2.5 px-5 font-medium text-navy-800 whitespace-nowrap">{a.projectId}</td>
                <td className="py-2.5 px-3 text-gray-700 max-w-[180px] truncate">{a.projectName}</td>
                <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{a.location}</td>
                <td className="py-2.5 px-3">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold text-gray-800">{a.riskScore}</span>
                    <RiskBadge level={a.riskLevel} size="sm" />
                  </div>
                </td>
                <td className="py-2.5 px-3 text-gray-600 whitespace-nowrap">{a.type}</td>
                <td className="py-2.5 px-3 text-gray-500 whitespace-nowrap">{formatDate(a.detectedDate)}</td>
                <td className="py-2.5 px-5 text-right">
                  <button
                    onClick={() => navigate(`${portalBase}/projects/${a.projectId}`)}
                    className="text-xs font-medium text-navy-700 hover:underline"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Card>
  );
}
