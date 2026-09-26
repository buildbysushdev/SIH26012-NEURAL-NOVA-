import { MapPin, Satellite, CheckCircle2, AlertTriangle, ShieldCheck, Info } from "lucide-react";
import Card from "../ui/Card";
import { formatDate } from "../../lib/format";
import type { Project } from "../../types";
import LocationOsmMap from "../common/LocationOsmMap";
import { getSatelliteImageUrl } from "../../services/api";

export default function ProjectOverview({ project }: { project: Project }) {
  const fields: [string, string][] = [
    ["Work Type", project.workType],
    ["Constituency", project.constituency],
    ["District", project.district],
    ["State", project.state],
    ["Implementing Agency", project.implementingAgency],
    ["Sanction Date", formatDate(project.sanctionDate)],
    ["Expected Completion", formatDate(project.expectedCompletion)],
    ["Current Status", project.status],
    ["Physical Progress", `${project.physicalProgress}%`],
  ];

  const satStatus = project.satelliteStatus || "no_imagery";
  const isGenuine = satStatus === "visible";
  const isAbsent = satStatus === "not_visible";

  return (
    <div className="space-y-6">
      {/* Top Grid: Project Information + OSM Map */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <Card className="lg:col-span-2">
          <h3 className="font-semibold text-gray-900 mb-4">Project Information</h3>
          <dl className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-4">
            {fields.map(([label, value]) => (
              <div key={label}>
                <dt className="text-xs text-gray-400">{label}</dt>
                <dd className="text-sm font-medium text-gray-800 mt-0.5">{value}</dd>
              </div>
            ))}
          </dl>
        </Card>
        <Card>
          <h3 className="font-semibold text-gray-900 mb-3 flex items-center gap-1.5">
            <MapPin size={15} /> Project Location · OpenStreetMap
          </h3>
          <LocationOsmMap
            latitude={project.latitude}
            longitude={project.longitude}
            locationName={`${project.district}, ${project.state}`}
            projectName={project.name}
            projectId={project.id}
            height="220px"
          />
        </Card>
      </div>

      {/* Satellite Physical Verification & Evidence Report Card */}
      <Card className="overflow-hidden">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-4 mb-4 border-b border-gray-100">
          <div>
            <h3 className="font-semibold text-gray-900 flex items-center gap-2">
              <Satellite size={17} className="text-cyan-600 dark:text-cyan-400" />
              <span>Satellite Physical Verification &amp; Spaceborne Optical Audit</span>
            </h3>
            <p className="text-xs text-gray-500 mt-0.5">
              Multi-spectral Sentinel-2 Level-2A &amp; High-Resolution Satellite Surveillance Telemetry
            </p>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            {isGenuine ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300 border border-emerald-300 dark:border-emerald-700">
                <CheckCircle2 size={13} /> Structure Present (Verified Genuine)
              </span>
            ) : isAbsent ? (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-rose-100 text-rose-800 dark:bg-rose-950 dark:text-rose-300 border border-rose-300 dark:border-rose-700">
                <AlertTriangle size={13} /> Structure Absent (Anomaly Flagged)
              </span>
            ) : (
              <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-300 border border-slate-300">
                <ShieldCheck size={13} /> Optical Imagery Telemetry
              </span>
            )}
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
          {/* Left: Satellite Image with Reticle */}
          <div className="lg:col-span-5 relative rounded-xl overflow-hidden border border-gray-300 dark:border-navy-700 bg-slate-950 shadow-md">
            <img
              src={getSatelliteImageUrl(project.id)}
              alt={`Satellite imagery for ${project.id}`}
              className="w-full h-auto object-cover max-h-[280px]"
            />
            <div className="absolute top-2.5 right-2.5 bg-black/75 backdrop-blur-md text-white text-[10px] font-mono px-2 py-0.5 rounded border border-white/20">
              {project.satellitePassDate ? `Pass Date: ${project.satellitePassDate}` : "Sentinel-2 Multi-spectral"}
            </div>
            <div className="absolute bottom-2 left-2 right-2 bg-slate-950/85 backdrop-blur-sm px-2.5 py-1 rounded text-[10px] text-gray-300 flex items-center justify-between font-mono">
              <span>{Number(project.latitude).toFixed(4)}°N, {Number(project.longitude).toFixed(4)}°E</span>
              <span className="text-cyan-400">10m GSD Optical Tile</span>
            </div>
          </div>

          {/* Right: Technical Satellite Audit Report */}
          <div className="lg:col-span-7 space-y-4 text-xs">
            <div
              className={`p-3.5 rounded-xl border ${
                isGenuine
                  ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-900 dark:text-emerald-200"
                  : isAbsent
                  ? "bg-rose-50 dark:bg-rose-950/40 border-rose-300 dark:border-rose-800 text-rose-900 dark:text-rose-200"
                  : "bg-slate-50 dark:bg-slate-800/40 border-slate-300 dark:border-slate-700 text-slate-900 dark:text-slate-200"
              }`}
            >
              <div className="font-bold text-sm flex items-center gap-1.5 mb-1">
                {isGenuine ? "✅ Verified Genuine Work: Physical Structure Present On-Ground" : isAbsent ? "⚠️ Surveillance Alert: Physical Structure Absent at Coordinates" : "🛰️ Spaceborne Ground Reference Scan"}
              </div>
              <p className="leading-relaxed opacity-90">
                {isGenuine
                  ? "Optical Sentinel-2 scan and SegFormer semantic segmentation confirm constructed built structure at the declared coordinates. Budget utilization aligns with physical progression."
                  : isAbsent
                  ? "Deep learning SegFormer land-cover scan reveals NO physical structure constructed at the reported coordinates. High priority for mandatory physical DISHA verification before next tranche release."
                  : "Optical reference imagery retrieved from spaceborne telemetry for declared project location. Cross-referenced with local district authority records."}
              </p>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              <div className="p-2.5 bg-gray-50 dark:bg-navy-800 rounded-lg border border-gray-200 dark:border-navy-700">
                <span className="text-gray-400 text-[10px] block">Sensor Constellation</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200 text-xs">Sentinel-2 / Esri High-Res</span>
              </div>
              <div className="p-2.5 bg-gray-50 dark:bg-navy-800 rounded-lg border border-gray-200 dark:border-navy-700">
                <span className="text-gray-400 text-[10px] block">Spatial Resolution</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200 text-xs">10m Multi-spectral</span>
              </div>
              <div className="p-2.5 bg-gray-50 dark:bg-navy-800 rounded-lg border border-gray-200 dark:border-navy-700">
                <span className="text-gray-400 text-[10px] block">Satellite Anomaly Score</span>
                <span className="font-semibold text-gray-800 dark:text-gray-200 text-xs">
                  {project.satelliteRiskScore !== undefined ? `${project.satelliteRiskScore} / 100` : "0 / 100"}
                </span>
              </div>
            </div>

            <div className="p-2.5 bg-cyan-50/60 dark:bg-cyan-950/30 rounded-lg border border-cyan-200 dark:border-cyan-800 text-[11px] text-cyan-900 dark:text-cyan-300 leading-relaxed flex items-start gap-2">
              <Info size={14} className="shrink-0 mt-0.5 text-cyan-600" />
              <span>
                <strong>Auditor Guidance:</strong> Satellite telemetry provides automated physical surveillance evidence under Rule 15 of DISHA guidelines. Ground geotagged photos from citizen reporting and mobile inspection corroborate this orbital evidence.
              </span>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
