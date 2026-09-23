import { useState } from "react";
import { FileText, Download, Eye } from "lucide-react";
import Card from "../components/ui/Card";
import Select from "../components/ui/Select";
import Input from "../components/ui/Input";
import Button from "../components/ui/Button";
import { Skeleton } from "../components/ui/Feedback";
import { generateReport } from "../services/api";
import { DISTRICTS_BY_STATE } from "../data/mockData";
import { useToast } from "../context/ToastContext";
import clsx from "clsx";

const REPORT_TYPES = [
  "Risk Summary",
  "Financial Anomalies",
  "Delayed Projects",
  "Duplicate Projects",
  "District Report",
  "State Report",
  "Complete MPLADS Report",
];

export default function Reports() {
  const { showToast } = useToast();
  const [type, setType] = useState(REPORT_TYPES[0]);
  const [state, setState] = useState("");
  const [district, setDistrict] = useState("");
  const [riskLevel, setRiskLevel] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [loading, setLoading] = useState(false);
  const [report, setReport] = useState<Awaited<ReturnType<typeof generateReport>> | null>(null);

  async function handleGenerate() {
    setLoading(true);
    setReport(null);
    const res = await generateReport({ type, state, district, riskLevel, dateFrom, dateTo });
    setReport(res);
    setLoading(false);
    showToast("Report generated successfully.", "success");
  }

  function downloadCSV() {
    if (!report) return;
    const header = ["Project", "Risk", "Amount"];
    const rows = report.rows.map((r) => [r.project, r.risk, r.amount]);
    const csv = [header, ...rows].map((r) => r.join(",")).join("\n");
    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${report.title.replace(/\s+/g, "_").toLowerCase()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
    showToast("Report exported as CSV.", "success");
  }

  function downloadPDF() {
    showToast("PDF generation is handled by the backend report service in production. This is a mock action.", "info");
  }

  return (
    <div className="space-y-5 animate-fade-in">
      <h2 className="text-xl font-bold text-gray-900">Reports</h2>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-1 h-fit">
          <h3 className="font-semibold text-gray-900 mb-4">Report Configuration</h3>
          <div className="space-y-3">
            <div>
              <p className="text-sm font-medium text-gray-700 mb-1.5">Report Type</p>
              <div className="grid grid-cols-1 gap-1.5">
                {REPORT_TYPES.map((t) => (
                  <button
                    key={t}
                    onClick={() => setType(t)}
                    className={clsx(
                      "text-left text-sm px-3 py-2 rounded-lg border transition-colors",
                      type === t ? "border-navy-700 bg-navy-50 text-navy-800 font-medium" : "border-gray-200 text-gray-600 hover:bg-gray-50"
                    )}
                  >
                    {t}
                  </button>
                ))}
              </div>
            </div>

            <div className="grid grid-cols-2 gap-2 pt-2">
              <Input label="From" type="date" value={dateFrom} onChange={(e) => setDateFrom(e.target.value)} />
              <Input label="To" type="date" value={dateTo} onChange={(e) => setDateTo(e.target.value)} />
            </div>
            <Select
              label="State"
              placeholder="All States"
              options={Object.keys(DISTRICTS_BY_STATE).map((s) => ({ value: s, label: s }))}
              value={state}
              onChange={(e) => {
                setState(e.target.value);
                setDistrict("");
              }}
            />
            <Select
              label="District"
              placeholder="All Districts"
              options={(state ? DISTRICTS_BY_STATE[state] : []).map((d) => ({ value: d, label: d }))}
              value={district}
              onChange={(e) => setDistrict(e.target.value)}
              disabled={!state}
            />
            <Select
              label="Risk Level"
              placeholder="All Risk Levels"
              options={["Low", "Medium", "High", "Critical"].map((r) => ({ value: r, label: r }))}
              value={riskLevel}
              onChange={(e) => setRiskLevel(e.target.value)}
            />

            <Button className="w-full mt-2" icon={<FileText size={15} />} loading={loading} onClick={handleGenerate}>
              Generate Report
            </Button>
          </div>
        </Card>

        <div className="lg:col-span-2">
          {loading && (
            <Card>
              <Skeleton className="h-6 w-1/3 mb-4" />
              <Skeleton className="h-32 w-full mb-3" />
              <Skeleton className="h-40 w-full" />
            </Card>
          )}

          {!loading && !report && (
            <Card className="h-full flex flex-col items-center justify-center text-center py-16">
              <Eye size={28} className="text-gray-300 mb-3" />
              <p className="font-medium text-gray-600">No report generated yet</p>
              <p className="text-sm text-gray-400 mt-1 max-w-sm">
                Configure a report type and filters, then click "Generate Report" to preview it here.
              </p>
            </Card>
          )}

          {!loading && report && (
            <Card className="animate-fade-in">
              <div className="flex items-center justify-between flex-wrap gap-3 mb-4">
                <div>
                  <h3 className="font-bold text-lg text-gray-900">{report.title}</h3>
                  <p className="text-xs text-gray-400">Generated {report.generatedAt}</p>
                </div>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" icon={<Download size={13} />} onClick={downloadCSV}>
                    Export CSV
                  </Button>
                  <Button variant="secondary" size="sm" icon={<Download size={13} />} onClick={downloadPDF}>
                    Download PDF
                  </Button>
                </div>
              </div>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-5">
                {report.summary.map((s) => (
                  <div key={s.label} className="bg-gray-50 rounded-lg p-3">
                    <p className="text-[11px] text-gray-400">{s.label}</p>
                    <p className="text-sm font-bold text-gray-800 mt-0.5">{s.value}</p>
                  </div>
                ))}
              </div>

              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-gray-400 text-xs border-b border-gray-100">
                    <th className="py-2 font-medium">Project</th>
                    <th className="py-2 font-medium">Risk</th>
                    <th className="py-2 font-medium text-right">Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {report.rows.map((r, i) => (
                    <tr key={i} className="border-b border-gray-50 last:border-0">
                      <td className="py-2.5 text-gray-700">{r.project}</td>
                      <td className="py-2.5 text-gray-600">{r.risk}</td>
                      <td className="py-2.5 text-gray-700 text-right">{r.amount}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}
