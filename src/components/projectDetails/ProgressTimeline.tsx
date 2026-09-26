import { CheckCircle2, Circle, AlertTriangle } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from "recharts";
import Card from "../ui/Card";
import { formatDate } from "../../lib/format";
import type { Project } from "../../types";

export default function ProgressTimeline({ project }: { project: Project }) {
  const delay = project.expectedProgress - project.physicalProgress;
  const isDelayed = delay > 10;

  const milestones = [
    { label: "Sanctioned", done: true, date: formatDate(project.sanctionDate) },
    { label: "Funds Released", done: project.releasedAmount > 0, date: project.releasedAmount > 0 ? "Recorded" : "Not reported" },
    { label: "Work Started", done: project.physicalProgress > 0, date: project.physicalProgress > 0 ? formatDate(project.sanctionDate) : "Pending" },
    { label: "Current Progress", done: project.physicalProgress > 0, date: project.physicalProgress > 0 ? `${project.physicalProgress}% complete` : "Not reported" },
    { label: "Expected Completion", done: project.status === "Completed", date: formatDate(project.expectedCompletion) },
  ];

  const progressChartData = [
    { stage: "Current", expected: project.expectedProgress, actual: project.physicalProgress },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Card>
          <p className="text-xs text-gray-400">Expected Progress</p>
          <p className="text-2xl font-bold text-gray-900 mt-1">{project.expectedProgress}%</p>
        </Card>
        <Card>
          <p className="text-xs text-gray-400">Actual Progress</p>
          <p className={`text-2xl font-bold mt-1 ${isDelayed ? "text-orange-600" : "text-gray-900"}`}>{project.physicalProgress}%</p>
        </Card>
      </div>

      {isDelayed && (
        <div className="flex items-center gap-3 bg-orange-50 border border-orange-200 rounded-xl p-4">
          <AlertTriangle size={18} className="text-orange-600 shrink-0" />
          <p className="text-sm text-orange-700">
            Project is trailing <span className="font-semibold">{delay}%</span> behind the expected progress
            timeline. Delay verification recommended.
          </p>
        </div>
      )}

      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Expected vs. Actual Progress</h3>
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={progressChartData} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f5" />
            <XAxis dataKey="stage" tick={{ fontSize: 12, fill: "#8a94a3" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#8a94a3" }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip formatter={(v: any) => `${v}%`} />
            <Legend iconType="circle" iconSize={8} />
            <Line type="monotone" dataKey="expected" stroke="#9ca3af" strokeWidth={2} strokeDasharray="4 4" name="Expected" />
            <Line type="monotone" dataKey="actual" stroke="#1e3a5f" strokeWidth={2.5} name="Actual" />
          </LineChart>
        </ResponsiveContainer>
      </Card>

      <Card>
        <h3 className="font-semibold text-gray-900 mb-4">Project Timeline</h3>
        <div className="space-y-0">
          {milestones.map((m, i) => (
            <div key={m.label} className="flex gap-3">
              <div className="flex flex-col items-center">
                {m.done ? (
                  <CheckCircle2 size={18} className="text-emerald-600" />
                ) : (
                  <Circle size={18} className="text-gray-300" />
                )}
                {i < milestones.length - 1 && <div className="w-px flex-1 bg-gray-200 my-1" />}
              </div>
              <div className="pb-5">
                <p className="text-sm font-medium text-gray-800">{m.label}</p>
                <p className="text-xs text-gray-400 mt-0.5">{m.date}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}
