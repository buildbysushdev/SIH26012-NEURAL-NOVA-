import { PieChart, Pie, Cell, Tooltip, Legend, ResponsiveContainer } from "recharts";
import Card from "../ui/Card";

interface Slice {
  name: string;
  value: number;
  color: string;
}

export default function RiskDistributionChart({ data }: { data: Slice[] }) {
  return (
    <Card>
      <h3 className="font-semibold text-gray-900 mb-1">Risk Distribution</h3>
      <p className="text-xs text-gray-500 mb-4">Across all active MPLADS projects</p>
      <ResponsiveContainer width="100%" height={240}>
        <PieChart>
          <Pie data={data} dataKey="value" nameKey="name" innerRadius={60} outerRadius={90} paddingAngle={2}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.color} stroke="white" strokeWidth={2} />
            ))}
          </Pie>
          <Tooltip formatter={(v: any) => v.toLocaleString("en-IN")} />
          <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
        </PieChart>
      </ResponsiveContainer>
    </Card>
  );
}
