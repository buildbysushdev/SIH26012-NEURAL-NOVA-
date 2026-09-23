import { useEffect, useState } from "react";
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";
import { Sparkles } from "lucide-react";
import Card from "../components/ui/Card";
import Select from "../components/ui/Select";
import { CardSkeleton } from "../components/ui/Feedback";
import { getAnalytics } from "../services/api";
import { DISTRICTS_BY_STATE, ALL_CATEGORIES } from "../data/mockData";

const PIE_COLORS = ["#16a34a", "#d97706", "#ea580c", "#dc2626"];

export default function Analytics() {
  const [data, setData] = useState<Awaited<ReturnType<typeof getAnalytics>> | null>(null);

  useEffect(() => {
    getAnalytics().then(setData);
  }, []);

  return (
    <div className="space-y-5 animate-fade-in">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900">Analytics</h2>
      </div>

      <Card>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <Select placeholder="All Years" options={["2024", "2025", "2026"].map((y) => ({ value: y, label: y }))} />
          <Select placeholder="All States" options={Object.keys(DISTRICTS_BY_STATE).map((s) => ({ value: s, label: s }))} />
          <Select placeholder="All Districts" options={[]} />
          <Select placeholder="All Categories" options={ALL_CATEGORIES.map((c) => ({ value: c, label: c }))} />
        </div>
      </Card>

      {!data ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {Array.from({ length: 4 }).map((_, i) => <CardSkeleton key={i} />)}
        </div>
      ) : (
        <>
          <div className="rounded-xl border border-navy-100 bg-gradient-to-br from-navy-50 to-white p-5">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-8 h-8 rounded-lg bg-navy-800 text-white flex items-center justify-center">
                <Sparkles size={15} />
              </div>
              <h3 className="font-semibold text-navy-900">AI Insights</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              {data.insights.map((text, i) => (
                <p key={i} className="text-sm text-navy-800 leading-relaxed bg-white/60 rounded-lg p-3 border border-navy-100">
                  {text}
                </p>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            <Card>
              <h3 className="font-semibold text-gray-900 mb-1">Average Project Cost Trend</h3>
              <p className="text-xs text-gray-500 mb-4">In ₹ Lakhs</p>
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={data.avgProjectCostTrend} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f5" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#8a94a3" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#8a94a3" }} axisLine={false} tickLine={false} unit="L" />
                  <Tooltip formatter={(v: any) => `₹${v}L`} />
                  <Line type="monotone" dataKey="value" stroke="#1e3a5f" strokeWidth={2.5} />
                </LineChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 mb-1">Cost Deviation by Category</h3>
              <p className="text-xs text-gray-500 mb-4">Average % deviation from sanctioned cost</p>
              <ResponsiveContainer width="100%" height={230}>
                <BarChart data={data.costDeviationByCategory} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f5" />
                  <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#8a94a3" }} axisLine={false} tickLine={false} interval={0} angle={-15} textAnchor="end" height={50} />
                  <YAxis tick={{ fontSize: 12, fill: "#8a94a3" }} axisLine={false} tickLine={false} unit="%" />
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Bar dataKey="value" fill="#ea580c" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 mb-1">Delay Distribution</h3>
              <p className="text-xs text-gray-500 mb-4">Share of projects by delay severity</p>
              <ResponsiveContainer width="100%" height={230}>
                <PieChart>
                  <Pie data={data.delayDistribution} dataKey="value" nameKey="name" innerRadius={55} outerRadius={85} paddingAngle={2}>
                    {data.delayDistribution.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="white" strokeWidth={2} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: any) => `${v}%`} />
                  <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
                </PieChart>
              </ResponsiveContainer>
            </Card>

            <Card>
              <h3 className="font-semibold text-gray-900 mb-1">Risk Trend (Quarterly)</h3>
              <p className="text-xs text-gray-500 mb-4">High and Critical risk project counts</p>
              <ResponsiveContainer width="100%" height={230}>
                <LineChart data={data.riskTrend} margin={{ left: -10 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f5" />
                  <XAxis dataKey="label" tick={{ fontSize: 12, fill: "#8a94a3" }} axisLine={false} tickLine={false} />
                  <YAxis tick={{ fontSize: 12, fill: "#8a94a3" }} axisLine={false} tickLine={false} />
                  <Tooltip />
                  <Legend iconType="circle" iconSize={8} />
                  <Line type="monotone" dataKey="high" stroke="#ea580c" strokeWidth={2} name="High Risk" />
                  <Line type="monotone" dataKey="critical" stroke="#dc2626" strokeWidth={2} name="Critical Risk" />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          </div>

          <Card>
            <h3 className="font-semibold text-gray-900 mb-1">State-wise High/Critical Risk Concentration</h3>
            <p className="text-xs text-gray-500 mb-4">Number of high and critical risk projects by state</p>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={data.stateWise} margin={{ left: -10 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#eef1f5" />
                <XAxis dataKey="name" tick={{ fontSize: 10, fill: "#8a94a3" }} axisLine={false} tickLine={false} interval={0} angle={-25} textAnchor="end" height={70} />
                <YAxis tick={{ fontSize: 12, fill: "#8a94a3" }} axisLine={false} tickLine={false} />
                <Tooltip />
                <Bar dataKey="value" fill="#1e3a5f" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>
        </>
      )}
    </div>
  );
}
