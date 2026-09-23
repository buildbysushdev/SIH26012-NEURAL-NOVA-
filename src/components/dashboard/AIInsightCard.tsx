import { Sparkles } from "lucide-react";

export default function AIInsightCard({ insights }: { insights: { id: string; text: string }[] }) {
  return (
    <div className="rounded-xl border border-navy-100 bg-gradient-to-br from-navy-50 to-white p-5">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-8 h-8 rounded-lg bg-navy-800 text-white flex items-center justify-center">
          <Sparkles size={15} />
        </div>
        <h3 className="font-semibold text-navy-900">AI Insight</h3>
      </div>
      <ul className="space-y-2.5">
        {insights.map((i) => (
          <li key={i.id} className="text-sm text-navy-800 leading-relaxed pl-3 border-l-2 border-navy-300">
            {i.text}
          </li>
        ))}
      </ul>
      <p className="text-[11px] text-navy-400 mt-3">
        AI-generated observation based on aggregated project data. Not a confirmed finding.
      </p>
    </div>
  );
}
