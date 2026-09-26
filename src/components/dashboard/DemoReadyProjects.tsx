import { useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Crosshair, MapPin, Satellite } from "lucide-react";
import type { Project } from "../../types";
import { getDemoShowcase, getSatelliteImageUrl } from "../../services/api";

export default function DemoReadyProjects({
  state,
  onOpen,
  title = "Demo-ready anomaly evidence",
}: {
  state?: string;
  onOpen: (project: Project) => void;
  title?: string;
}) {
  const [projects, setProjects] = useState<Project[] | null>(null);

  useEffect(() => {
    let active = true;
    setProjects(null);
    getDemoShowcase(state, 4)
      .then((items) => active && setProjects(items))
      .catch(() => active && setProjects([]));
    return () => { active = false; };
  }, [state]);

  if (projects && projects.length === 0) return null;

  return (
    <section className="overflow-hidden rounded-xl border border-amber-200 bg-white shadow-sm dark:border-amber-900/60 dark:bg-navy-900">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-amber-100 bg-amber-50/70 px-4 py-3 dark:border-amber-900/40 dark:bg-amber-950/20">
        <div>
          <div className="flex items-center gap-2">
            <Crosshair size={16} className="text-amber-700 dark:text-amber-400" />
            <h2 className="text-sm font-bold text-gray-900 dark:text-white">{title}</h2>
            <span className="rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300">
              TRUSTED COORDINATES
            </span>
          </div>
          <p className="mt-0.5 text-[11px] text-gray-600 dark:text-gray-400">
            Real MPLADS records · dataset anomaly flags · Esri reference imagery for manual review
          </p>
        </div>
        <span className="text-[10px] font-semibold text-gray-500">Select a card to open the full evidence dossier</span>
      </div>

      <div className="grid grid-cols-1 gap-3 p-3 sm:grid-cols-2 xl:grid-cols-4">
        {!projects
          ? Array.from({ length: 4 }).map((_, index) => <div key={index} className="h-48 animate-pulse rounded-lg bg-gray-100 dark:bg-navy-800" />)
          : projects.map((project) => (
              <button
                key={project.id}
                onClick={() => onOpen(project)}
                className="overflow-hidden rounded-lg border border-gray-200 bg-white text-left transition hover:-translate-y-0.5 hover:border-amber-400 hover:shadow-md dark:border-navy-700 dark:bg-navy-950"
              >
                <div className="relative h-24 bg-gray-100">
                  <img src={getSatelliteImageUrl(project.id)} alt="Reference satellite view" className="h-full w-full object-cover" />
                  <span className="absolute left-2 top-2 inline-flex items-center gap-1 rounded bg-red-700 px-2 py-1 text-[10px] font-extrabold text-white shadow">
                    <AlertTriangle size={11} /> ANOMALY DETECTED
                  </span>
                  <span className="absolute bottom-1.5 right-1.5 rounded bg-black/70 px-1.5 py-0.5 text-[9px] font-semibold text-white">
                    Esri reference imagery
                  </span>
                </div>
                <div className="space-y-2 p-3">
                  <p className="line-clamp-2 text-xs font-bold leading-snug text-gray-900 dark:text-gray-100">{project.name}</p>
                  <div className="flex items-center justify-between gap-2">
                    <span className="inline-flex items-center gap-1 text-[10px] text-gray-600 dark:text-gray-400"><MapPin size={10} /> {project.localityName || project.district}, {project.state}</span>
                    <span className="font-mono text-xs font-black text-red-700 dark:text-red-400">{project.riskScore}/100</span>
                  </div>
                  <div className="flex items-center justify-between text-[10px]">
                    <span className="inline-flex items-center gap-1 font-mono text-gray-500"><Satellite size={10} /> {project.latitude.toFixed(4)}, {project.longitude.toFixed(4)}</span>
                    {project.feedbackStatus === "false_positive" && <span className="inline-flex items-center gap-1 font-bold text-emerald-700"><CheckCircle2 size={10} /> Genuine</span>}
                  </div>
                </div>
              </button>
            ))}
      </div>
    </section>
  );
}
