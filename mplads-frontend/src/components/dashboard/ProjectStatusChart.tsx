import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import Card from "../ui/Card";

const COLORS: Record<string, string> = {
  "Not Started": "#9ca3af",
  "In Progress": "#3d6191",
  Completed: "#16a34a",
  Delayed: "#ea580c",
};

export default function ProjectStatusChart({ data }: { data: { name: string; value: number }[] }) {
  return (
    <Card>
      <h3 className="font-semibold text-gray-900 mb-1">Project Status</h3>
      <p className="text-xs text-gray-500 mb-4">Distribution across the project lifecycle</p>
      <ResponsiveContainer width="100%" height={240}>
        <BarChart data={data} margin={{ left: -20 }}>
          <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f5" />
          <XAxis dataKey="name" tick={{ fontSize: 11, fill: "#8a94a3" }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 12, fill: "#8a94a3" }} axisLine={false} tickLine={false} />
          <Tooltip formatter={(v: any) => v.toLocaleString("en-IN")} />
          <Bar dataKey="value" radius={[6, 6, 0, 0]}>
            {data.map((d, i) => (
              <Cell key={i} fill={COLORS[d.name] ?? "#3d6191"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </Card>
  );
}
