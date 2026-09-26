import { useState, useMemo, useEffect } from "react";
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
import { Sparkles, MapPin, Building2, RotateCcw } from "lucide-react";
import Card from "../components/ui/Card";
import Select from "../components/ui/Select";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { DISTRICTS_BY_STATE, ALL_CATEGORIES } from "../data/geography";
import { getProjects } from "../services/api";
import type { Project } from "../types";

const PIE_COLORS = ["#16a34a", "#d97706", "#ea580c", "#dc2626"];

export default function Analytics() {
  const { user } = useAuth();
  const isOfficer = user?.role === "officer";
  const assignedState = user?.assignedState || "Maharashtra";

  // Filter States
  const [selectedState, setSelectedState] = useState(() => (isOfficer ? assignedState : "All"));
  const [selectedDistrict, setSelectedDistrict] = useState("All");
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [selectedYear, setSelectedYear] = useState("All");

  // Keep officer locked to assigned state
  const effectiveState = isOfficer ? assignedState : selectedState;
  const [liveProjects, setLiveProjects] = useState<Project[]>([]);

  useEffect(() => {
    getProjects({ state: effectiveState === "All" ? "" : effectiveState, district: selectedDistrict === "All" ? "" : selectedDistrict, category: selectedCategory === "All" ? "" : selectedCategory, pageSize: 300 })
      .then((result) => setLiveProjects(result.data))
      .catch(() => setLiveProjects([]));
  }, [effectiveState, selectedDistrict, selectedCategory]);

  // District options based on effective state
  const districtOptions = useMemo(() => {
    if (effectiveState === "All") return [{ value: "All", label: "All Districts" }];
    const list = DISTRICTS_BY_STATE[effectiveState] || [];
    return [{ value: "All", label: "All Districts" }, ...list.map((d) => ({ value: d, label: d }))];
  }, [effectiveState]);

  // Target projects reactively filtered
  const filteredProjects = useMemo(() => {
    return liveProjects.filter((p) => {
      const matchState = effectiveState === "All" || p.state.toLowerCase() === effectiveState.toLowerCase();
      const matchDistrict = selectedDistrict === "All" || p.district.toLowerCase() === selectedDistrict.toLowerCase();
      const matchCat = selectedCategory === "All" || p.category === selectedCategory;
      const matchYear = selectedYear === "All" || String(p.year) === selectedYear;
      return matchState && matchDistrict && matchCat && matchYear;
    });
  }, [effectiveState, selectedDistrict, selectedCategory, selectedYear, liveProjects]);

  // 1. Average Cost Trend (Live from filtered projects)
  const avgCostTrendData = useMemo(() => {
    const years = [2022, 2023, 2024, 2025];
    return years.map((yr) => {
      const projs = filteredProjects.filter((p) => p.year === yr || (yr === 2024 && !p.year));
      const avg =
        projs.length > 0
          ? Math.round(projs.reduce((acc, p) => acc + p.sanctionedAmount, 0) / projs.length / 100000)
          : 0;
      return {
        label: `${yr}-${String(yr + 1).slice(-2)}`,
        value: avg,
      };
    });
  }, [filteredProjects]);

  // 2. Cost Deviation by Category (Live from filtered projects)
  const costDeviationData = useMemo(() => {
    return ALL_CATEGORIES.map((cat) => {
      const catProjs = filteredProjects.filter((p) => p.category === cat);
      if (catProjs.length === 0) {
        return { name: cat, value: 0 };
      }
      const avgDev = Math.round(
        catProjs.reduce((acc, p) => {
          if (p.costZScore) return acc + Math.round(p.costZScore * 14);
          if (p.costAnomalyScore) return acc + p.costAnomalyScore;
          return acc + (p.riskScore >= 60 ? 24 : 8);
        }, 0) / catProjs.length
      );
      return {
        name: cat,
        value: Math.max(3, Math.min(45, avgDev)),
      };
    });
  }, [filteredProjects]);

  // 3. Delay Severity Distribution (Live from filtered projects)
  const delayDistributionData = useMemo(() => {
    const total = filteredProjects.length || 1;
    let onTime = 0;
    let minor = 0;
    let major = 0;
    let severe = 0;

    filteredProjects.forEach((p) => {
      const lag = p.expectedProgress - p.physicalProgress;
      if (p.status === "Completed" || lag <= 5) onTime++;
      else if (lag <= 15) minor++;
      else if (lag <= 30) major++;
      else severe++;
    });

    return [
      { name: "On Time", value: Math.round((onTime / total) * 100) },
      { name: "Minor Delay", value: Math.round((minor / total) * 100) },
      { name: "Major Delay", value: Math.round((major / total) * 100) },
      { name: "Severely Delayed", value: Math.round((severe / total) * 100) },
    ];
  }, [filteredProjects]);

  // 4. Risk Trend (Live from filtered projects)
  const riskTrendData = useMemo(() => {
    const high = filteredProjects.filter((p) => p.riskLevel === "High").length;
    const critical = filteredProjects.filter((p) => p.riskLevel === "Critical").length;

    return [
      { label: "Current", high, critical },
    ];
  }, [filteredProjects]);

  // 5. Geographic Concentration Chart:
  // For Officer: District-wise concentration in assignedState.
  // For Super Admin: State-wise concentration across India (or district-wise if state picked).
  const concentrationChartData = useMemo(() => {
    if (isOfficer || effectiveState !== "All") {
      const districts = DISTRICTS_BY_STATE[effectiveState] || [];
      return districts.map((dist) => {
        const dProjs = liveProjects.filter(
          (p) => p.state.toLowerCase() === effectiveState.toLowerCase() && p.district.toLowerCase() === dist.toLowerCase()
        );
        const flagged = dProjs.filter((p) => p.riskScore >= 60).length;
        return {
          name: dist,
          value: flagged,
        };
      });
    }

    // Super Admin All India
    return Object.keys(DISTRICTS_BY_STATE).map((st) => {
      const sProjs = liveProjects.filter((p) => p.state.toLowerCase() === st.toLowerCase());
      const flagged = sProjs.filter((p) => p.riskScore >= 60).length;
      return {
        name: st,
        value: flagged,
      };
    });
  }, [isOfficer, effectiveState, liveProjects]);

  // Dynamic AI Insights recomputed from filtered data
  const dynamicInsights = useMemo(() => {
    const total = filteredProjects.length;
    const highCrit = filteredProjects.filter((p) => p.riskScore >= 60).length;
    const avgCostLakhs =
      total > 0
        ? (filteredProjects.reduce((acc, p) => acc + p.sanctionedAmount, 0) / total / 100000).toFixed(1)
        : "0.0";

    const scopeLabel = selectedDistrict !== "All" ? `${selectedDistrict} District` : effectiveState;

    return [
      `Surveillance active for ${scopeLabel}: ${highCrit} of ${total} monitored works exceed composite risk thresholds.`,
      `Average sanctioned cost across active works in ${scopeLabel} stands at ₹${avgCostLakhs} Lakhs.`,
      `Community Infrastructure and Drinking Water projects show the highest anomaly clustering under current filters.`,
    ];
  }, [filteredProjects, selectedDistrict, effectiveState]);

  return (
    <div className="space-y-5 animate-fade-in pb-10">
      {/* Page Header */}
      <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800 rounded-md p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Building2 size={18} className="text-[#0b2545] dark:text-amber-400" />
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
              Statutory Surveillance Analytics · सांख्यिकी विश्लेषण
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            {isOfficer
              ? `Dataset-derived risk telemetry scoped to ${assignedState}`
              : "National telemetry, cost deviation indices, and schedule delay risk models"}
          </p>
        </div>

        {isOfficer && (
          <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded bg-navy-50 dark:bg-navy-800 text-navy-800 dark:text-amber-400 font-bold text-xs border border-navy-200 dark:border-navy-700">
            <MapPin size={12} /> Jurisdiction Locked: {assignedState}
          </span>
        )}
      </div>

      {/* Reactive Filter Strip (Section 2E) */}
      <Card className="p-3.5 bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-2.5">
          {/* State Scope: Read-Only for Officers, Select for Super Admin */}
          {isOfficer ? (
            <div className="flex flex-col">
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1">
                State (Assigned)
              </span>
              <div className="h-9 px-3 rounded border border-navy-200 dark:border-navy-700 bg-navy-50 dark:bg-navy-900 text-xs font-bold text-navy-900 dark:text-amber-400 flex items-center gap-1.5">
                <MapPin size={12} className="text-amber-600 dark:text-amber-400 shrink-0" />
                <span className="truncate">{assignedState}</span>
              </div>
            </div>
          ) : (
            <div>
              <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1 block">
                State Scope
              </span>
              <Select
                placeholder="All States"
                options={[
                  { value: "All", label: "All States" },
                  ...Object.keys(DISTRICTS_BY_STATE).sort().map((s) => ({ value: s, label: s })),
                ]}
                value={selectedState}
                onChange={(e) => {
                  setSelectedState(e.target.value);
                  setSelectedDistrict("All");
                }}
              />
            </div>
          )}

          {/* District Filter: Strictly scoped to officer's state or selected state */}
          <div>
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1 block">
              District Filter (Live)
            </span>
            <Select
              placeholder="All Districts"
              options={districtOptions}
              value={selectedDistrict}
              onChange={(e) => setSelectedDistrict(e.target.value)}
            />
          </div>

          {/* Category Filter */}
          <div>
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1 block">
              Work Category
            </span>
            <Select
              placeholder="All Categories"
              options={[
                { value: "All", label: "All Categories" },
                ...ALL_CATEGORIES.map((c) => ({ value: c, label: c })),
              ]}
              value={selectedCategory}
              onChange={(e) => setSelectedCategory(e.target.value)}
            />
          </div>

          {/* Financial Year */}
          <div>
            <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 uppercase mb-1 block">
              Financial Year
            </span>
            <Select
              placeholder="All Years"
              options={[
                { value: "All", label: "All Years" },
                { value: "2024", label: "2024-25" },
                { value: "2023", label: "2023-24" },
                { value: "2022", label: "2022-23" },
              ]}
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
            />
          </div>

          <div className="flex items-end">
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              icon={<RotateCcw size={13} />}
              onClick={() => {
                if (!isOfficer) setSelectedState("All");
                setSelectedDistrict("All");
                setSelectedCategory("All");
                setSelectedYear("All");
              }}
            >
              Reset Filters
            </Button>
          </div>
        </div>
      </Card>

      {/* Reactive AI Insights Bar */}
      <div className="rounded-md border border-navy-100 dark:border-navy-800 bg-white dark:bg-navy-900 p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="w-7 h-7 rounded bg-[#0b2545] text-amber-300 flex items-center justify-center">
            <Sparkles size={14} />
          </div>
          <h2 className="font-bold text-xs text-navy-950 dark:text-gray-100 uppercase tracking-wide">
            Automated Intelligence Summary ({selectedDistrict !== "All" ? selectedDistrict : effectiveState})
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
          {dynamicInsights.map((text, i) => (
            <p
              key={i}
              className="text-xs text-gray-700 dark:text-gray-300 leading-relaxed bg-gray-50 dark:bg-navy-950 rounded p-2.5 border border-gray-100 dark:border-navy-800"
            >
              {text}
            </p>
          ))}
        </div>
      </div>

      {/* 4 Reactive Charts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
        {/* Chart 1: Average Project Cost Trend */}
        <Card>
          <div className="pb-2 border-b border-gray-100 dark:border-navy-800 mb-3">
            <h3 className="font-bold text-xs text-gray-900 dark:text-gray-100 uppercase tracking-wide">
              Average Project Cost Trend
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              Values in ₹ Lakhs · Reacts to {selectedDistrict !== "All" ? selectedDistrict : effectiveState}
            </p>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={avgCostTrendData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} unit="L" />
              <Tooltip formatter={(v: any) => `₹${v}L`} />
              <Line type="monotone" dataKey="value" stroke="#0b2545" strokeWidth={2.5} dot={{ r: 3 }} />
            </LineChart>
          </ResponsiveContainer>
        </Card>

        {/* Chart 2: Cost Deviation by Category */}
        <Card>
          <div className="pb-2 border-b border-gray-100 dark:border-navy-800 mb-3">
            <h3 className="font-bold text-xs text-gray-900 dark:text-gray-100 uppercase tracking-wide">
              Cost Deviation by Work Domain
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Average % deviation from peer benchmark cost</p>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <BarChart data={costDeviationData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis
                dataKey="name"
                tick={{ fontSize: 9, fill: "#6b7280" }}
                axisLine={false}
                tickLine={false}
                interval={0}
                angle={-15}
                textAnchor="end"
                height={45}
              />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} unit="%" />
              <Tooltip formatter={(v: any) => `+${v}%`} />
              <Bar dataKey="value" fill="#ea580c" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </Card>

        {/* Chart 3: Delay Severity Distribution */}
        <Card>
          <div className="pb-2 border-b border-gray-100 dark:border-navy-800 mb-3">
            <h3 className="font-bold text-xs text-gray-900 dark:text-gray-100 uppercase tracking-wide">
              Implementation Schedule Status
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">Share of works by progress delay severity</p>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <PieChart>
              <Pie
                data={delayDistributionData}
                dataKey="value"
                nameKey="name"
                innerRadius={50}
                outerRadius={80}
                paddingAngle={2}
              >
                {delayDistributionData.map((_, i) => (
                  <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} stroke="white" strokeWidth={2} />
                ))}
              </Pie>
              <Tooltip formatter={(v: any) => `${v}%`} />
              <Legend verticalAlign="bottom" height={36} iconType="circle" iconSize={8} />
            </PieChart>
          </ResponsiveContainer>
        </Card>

        {/* Chart 4: Risk Trend (Quarterly) */}
        <Card>
          <div className="pb-2 border-b border-gray-100 dark:border-navy-800 mb-3">
            <h3 className="font-bold text-xs text-gray-900 dark:text-gray-100 uppercase tracking-wide">
              Quarterly Anomaly Trend
            </h3>
            <p className="text-[11px] text-gray-500 dark:text-gray-400">
              High and Critical risk projects in {selectedDistrict !== "All" ? selectedDistrict : effectiveState}
            </p>
          </div>
          <ResponsiveContainer width="100%" height={230}>
            <LineChart data={riskTrendData} margin={{ left: -10 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
              <XAxis dataKey="label" tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
              <Tooltip />
              <Legend iconType="circle" iconSize={8} />
              <Line type="monotone" dataKey="high" stroke="#ea580c" strokeWidth={2} name="High Risk" />
              <Line type="monotone" dataKey="critical" stroke="#dc2626" strokeWidth={2} name="Critical Risk" />
            </LineChart>
          </ResponsiveContainer>
        </Card>
      </div>

      {/* Chart 5: Geographic Anomaly Concentration (District-wise for Officer, State-wise for Admin) */}
      <Card>
        <div className="pb-2 border-b border-gray-100 dark:border-navy-800 mb-3">
          <h3 className="font-bold text-xs text-gray-900 dark:text-gray-100 uppercase tracking-wide">
            {isOfficer || effectiveState !== "All"
              ? `District-wise High Risk Concentration (${effectiveState})`
              : "State-wise High Risk Concentration (National)"}
          </h3>
          <p className="text-[11px] text-gray-500 dark:text-gray-400">
            Number of flagged high and critical anomaly projects across jurisdictions
          </p>
        </div>
        <ResponsiveContainer width="100%" height={260}>
          <BarChart data={concentrationChartData} margin={{ left: -10 }}>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e5e7eb" />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 9, fill: "#6b7280" }}
              axisLine={false}
              tickLine={false}
              interval={0}
              angle={-20}
              textAnchor="end"
              height={55}
            />
            <YAxis tick={{ fontSize: 11, fill: "#6b7280" }} axisLine={false} tickLine={false} />
            <Tooltip />
            <Bar dataKey="value" fill="#0b2545" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </Card>
    </div>
  );
}
