import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import { AlertTriangle, Wallet, ArrowDownToLine, ReceiptIndianRupee, Percent } from "lucide-react";
import Card from "../ui/Card";
import { formatINR } from "../../lib/format";
import type { Project } from "../../types";

export default function FinancialOverview({ project }: { project: Project }) {
  const utilization = Math.round((project.expenditure / project.sanctionedAmount) * 1000) / 10;
  const deviationPct = Math.round(((project.expenditure - project.peerAverageCost) / project.peerAverageCost) * 100);
  const isAnomalous = deviationPct > 15;

  const timelineData = [
    { stage: "Sanctioned", amount: project.sanctionedAmount },
    { stage: "Released", amount: project.releasedAmount },
    { stage: "Payments", amount: Math.round(project.releasedAmount * 0.9) },
    { stage: "Expenditure", amount: project.expenditure },
  ];

  const kpis = [
    { label: "Sanctioned Amount", value: formatINR(project.sanctionedAmount), icon: Wallet },
    { label: "Released Amount", value: formatINR(project.releasedAmount), icon: ArrowDownToLine },
    { label: "Expenditure", value: formatINR(project.expenditure), icon: ReceiptIndianRupee },
    { label: "Utilization %", value: `${utilization}%`, icon: Percent },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map((k) => (
          <Card key={k.label}>
            <div className="w-9 h-9 rounded-lg bg-navy-50 text-navy-700 flex items-center justify-center mb-3">
              <k.icon size={16} />
            </div>
            <p className="text-lg font-bold text-gray-900">{k.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{k.label}</p>
          </Card>
        ))}
      </div>

      {isAnomalous && (
        <div className="flex items-start gap-3 bg-red-50 border border-red-200 rounded-xl p-4">
          <div className="w-9 h-9 rounded-lg bg-red-100 text-red-600 flex items-center justify-center shrink-0">
            <AlertTriangle size={17} />
          </div>
          <div>
            <p className="font-semibold text-red-800 text-sm">Cost deviation detected</p>
            <p className="text-sm text-red-700 mt-1">
              Estimated Cost: <span className="font-semibold">{formatINR(project.sanctionedAmount)}</span> · Actual
              Expenditure: <span className="font-semibold">{formatINR(project.expenditure)}</span> · Deviation:{" "}
              <span className="font-semibold">+{deviationPct}%</span>
            </p>
            <p className="text-xs text-red-600 mt-2">
              This is a risk signal requiring verification, not a confirmation of financial irregularity.
            </p>
          </div>
        </div>
      )}

      <Card>
        <h3 className="font-semibold text-gray-900 mb-1">Financial Timeline</h3>
        <p className="text-xs text-gray-500 mb-4">Sanctioned → Released → Payments → Expenditure</p>
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={timelineData} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f5" />
            <XAxis dataKey="stage" tick={{ fontSize: 12, fill: "#8a94a3" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 11, fill: "#8a94a3" }} axisLine={false} tickLine={false} tickFormatter={(v) => formatINR(v)} />
            <Tooltip formatter={(v: any) => formatINR(v)} />
            <Bar dataKey="amount" fill="#1e3a5f" radius={[6, 6, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Comparison Against Similar Projects</h3>
        <div className="flex items-center gap-8">
          <div>
            <p className="text-xs text-gray-400">Peer Average</p>
            <p className="text-xl font-bold text-gray-800 mt-1">{formatINR(project.peerAverageCost)}</p>
          </div>
          <div className="h-10 w-px bg-gray-200" />
          <div>
            <p className="text-xs text-gray-400">Current Project</p>
            <p className={`text-xl font-bold mt-1 ${isAnomalous ? "text-red-600" : "text-gray-800"}`}>
              {formatINR(project.expenditure)}
            </p>
          </div>
        </div>
      </Card>
    </div>
  );
}
