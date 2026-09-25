import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from "recharts";
import { Info } from "lucide-react";
import Card from "../ui/Card";

export default function SHAPChart({ factors }: { factors: { label: string; value: number }[] }) {
  const data = [...factors].sort((a, b) => a.value - b.value);

  return (
    <Card>
      <h3 className="font-semibold text-gray-900">Why was this project flagged?</h3>
      <p className="text-xs text-gray-500 mt-0.5 mb-4">
        Relative contribution of each signal to the overall risk score
      </p>
      <ResponsiveContainer width="100%" height={Math.max(220, data.length * 42)}>
        <BarChart data={data} layout="vertical" margin={{ left: 10, right: 30 }}>
          <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#eef1f5" />
          <XAxis type="number" tick={{ fontSize: 11, fill: "#8a94a3" }} axisLine={false} tickLine={false} unit=" pts" />
          <YAxis
            type="category"
            dataKey="label"
            width={170}
            tick={{ fontSize: 12, fill: "#3a4453" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip formatter={(v: any) => [`+${v} risk points`, "Contribution"]} />
          <Bar dataKey="value" radius={[0, 6, 6, 0]} barSize={18}>
            {data.map((d, i) => (
              <Cell key={i} fill={d.value >= 18 ? "#dc2626" : d.value >= 10 ? "#ea580c" : "#3d6191"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
      <div className="mt-4 flex items-start gap-2 bg-navy-50 border border-navy-100 rounded-lg px-3 py-2.5 text-xs text-navy-700">
        <Info size={14} className="mt-0.5 shrink-0" />
        <span>
          Positive values indicate risk contribution. This is a model-generated SHAP feature attribution
          derived from historical project indicators and variance metrics.
        </span>
      </div>
    </Card>
  );
}
