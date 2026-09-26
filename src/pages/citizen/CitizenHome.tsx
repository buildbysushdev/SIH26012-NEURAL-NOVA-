import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileCheck2, Banknote, HardHat, PartyPopper, MessageSquareWarning, ShieldCheck } from "lucide-react";
import CitizenSearch from "../../components/citizen/CitizenSearch";
import CitizenProjectCard from "../../components/citizen/CitizenProjectCard";
import { EmptyState, Skeleton } from "../../components/ui/Feedback";
import { getProjects } from "../../services/api";
import type { Project } from "../../types";
import DemoReadyProjects from "../../components/dashboard/DemoReadyProjects";

const STEPS = [
  { icon: FileCheck2, label: "Work Recommended", desc: "MP recommends a development work in the constituency." },
  { icon: Banknote, label: "Work Sanctioned", desc: "The district authority reviews and sanctions the project." },
  { icon: HardHat, label: "Work Executed", desc: "The implementing agency carries out construction or works." },
  { icon: PartyPopper, label: "Work Completed", desc: "The project is completed and handed over for public use." },
];

export default function CitizenHome() {
  const navigate = useNavigate();
  const [results, setResults] = useState<Project[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [searched, setSearched] = useState(false);

  async function handleSearch(query: string) {
    setLoading(true);
    setSearched(true);
    const res = await getProjects({ search: query, pageSize: 6 });
    setResults(res.data);
    setLoading(false);
  }

  return (
    <div>
      <section className="bg-gradient-to-b from-navy-900 to-navy-800 text-white">
        <div className="max-w-4xl mx-auto px-4 py-16 sm:py-20 text-center">
          <div className="inline-flex items-center gap-1.5 bg-white/10 text-navy-100 text-xs font-medium px-3 py-1.5 rounded-full mb-5">
            <ShieldCheck size={13} /> AI-Assisted Public Transparency Platform
          </div>
          <h1 className="text-3xl sm:text-4xl font-bold leading-tight">
            Track Development Projects in Your Area
          </h1>
          <p className="text-navy-200 mt-3 max-w-xl mx-auto text-sm sm:text-base">
            Search for MPLADS-funded projects near you, follow their progress, and report issues directly.
          </p>
        </div>
      </section>

      <section className="max-w-4xl mx-auto px-4 -mt-8 sm:-mt-9 relative z-10">
        <CitizenSearch onSearch={handleSearch} loading={loading} />
      </section>

      <section className="max-w-6xl mx-auto px-4 mt-10">
        <DemoReadyProjects
          onOpen={(project) => navigate(`/citizen/project/${encodeURIComponent(project.id)}`)}
          title="Projects with location and reference imagery"
        />
      </section>

      <section className="max-w-4xl mx-auto px-4 mt-10">
        {loading && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {Array.from({ length: 4 }).map((_, i) => (
              <Skeleton key={i} className="h-28 w-full rounded-xl" />
            ))}
          </div>
        )}
        {!loading && searched && results && results.length === 0 && (
          <EmptyState title="No matching projects found" description="Try a different project ID, name, or location." />
        )}
        {!loading && results && results.length > 0 && (
          <div>
            <h2 className="text-sm font-semibold text-gray-500 mb-3">Search Results</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {results.map((p) => (
                <CitizenProjectCard key={p.id} project={p} />
              ))}
            </div>
          </div>
        )}
      </section>

      <section id="about" className="max-w-4xl mx-auto px-4 py-14">
        <h2 className="text-xl font-bold text-gray-900 text-center mb-2">How MPLADS Works</h2>
        <p className="text-sm text-gray-500 text-center mb-8">
          Understanding the lifecycle of a development project under the scheme.
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map((s, i) => (
            <div key={s.label} className="bg-white border border-gray-200 rounded-xl p-5 relative">
              <span className="absolute top-4 right-4 text-2xl font-bold text-gray-100">{i + 1}</span>
              <div className="w-10 h-10 rounded-lg bg-navy-50 text-navy-700 flex items-center justify-center mb-3">
                <s.icon size={18} />
              </div>
              <p className="font-semibold text-gray-900 text-sm">{s.label}</p>
              <p className="text-xs text-gray-500 mt-1 leading-relaxed">{s.desc}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-gray-50 border-t border-gray-100">
        <div className="max-w-4xl mx-auto px-4 py-12 text-center">
          <div className="w-12 h-12 rounded-full bg-amber-50 text-amber-600 flex items-center justify-center mx-auto mb-4">
            <MessageSquareWarning size={22} />
          </div>
          <h2 className="text-lg font-bold text-gray-900">Report an Issue</h2>
          <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
            Noticed a project that isn't progressing, seems incomplete, or looks suspicious? Let us know.
          </p>
          <button
            onClick={() => navigate("/citizen/report")}
            className="mt-5 bg-navy-800 text-white text-sm font-medium px-5 py-2.5 rounded-lg hover:bg-navy-700"
          >
            Report an Issue
          </button>
        </div>
      </section>
    </div>
  );
}
