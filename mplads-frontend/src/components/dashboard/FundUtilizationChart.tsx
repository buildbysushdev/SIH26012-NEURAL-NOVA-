import { useEffect, useState } from "react";
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from "recharts";
import Card from "../ui/Card";
import { getFundUtilizationTrend } from "../../services/api";
import { Skeleton } from "../ui/Feedback";
import clsx from "clsx";

type Period = "monthly" | "quarterly" | "yearly";

export default function FundUtilizationChart() {
  const [period, setPeriod] = useState<Period>("monthly");
  const [data, setData] = useState<{ label: string; utilization: number }[] | null>(null);

  useEffect(() => {
    setData(null);
    getFundUtilizationTrend(period).then(setData);
  }, [period]);

  return (
    <Card>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h3 className="font-semibold text-gray-900">Fund Utilization Trend</h3>
          <p className="text-xs text-gray-500 mt-0.5">Percentage of sanctioned funds utilized</p>
        </div>
        <div className="flex bg-gray-100 rounded-lg p-0.5">
          {(["monthly", "quarterly", "yearly"] as Period[]).map((p) => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={clsx(
                "text-xs font-medium px-2.5 py-1.5 rounded-md capitalize transition-colors",
                period === p ? "bg-white shadow-sm text-navy-800" : "text-gray-500"
              )}
            >
              {p}
            </button>
          ))}
        </div>
      </div>
      {!data ? (
        <Skeleton className="h-[240px] w-full" />
      ) : (
        <ResponsiveContainer width="100%" height={240}>
          <AreaChart data={data} margin={{ left: -20 }}>
            <defs>
              <linearGradient id="utilGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor="#1e3a5f" stopOpacity={0.35} />
                <stop offset="95%" stopColor="#1e3a5f" stopOpacity={0} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f5" />
            <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#8a94a3" }} axisLine={false} tickLine={false} />
            <YAxis tick={{ fontSize: 12, fill: "#8a94a3" }} axisLine={false} tickLine={false} unit="%" />
            <Tooltip formatter={(v: any) => `${v}%`} />
            <Area type="monotone" dataKey="utilization" stroke="#1e3a5f" strokeWidth={2} fill="url(#utilGrad)" />
          </AreaChart>
        </ResponsiveContainer>
      )}
    </Card>
  );
}
