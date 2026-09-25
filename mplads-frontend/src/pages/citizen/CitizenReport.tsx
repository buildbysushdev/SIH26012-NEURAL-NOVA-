import { useSearchParams } from "react-router-dom";
import CitizenReportForm from "../../components/citizen/CitizenReportForm";

export default function CitizenReport() {
  const [params] = useSearchParams();
  const prefillProjectId = params.get("projectId") ?? undefined;

  return (
    <div className="max-w-xl mx-auto px-4 py-10">
      <div className="text-center mb-6">
        <h1 className="text-xl font-bold text-gray-900">Report an Issue</h1>
        <p className="text-sm text-gray-500 mt-1">Help us keep MPLADS projects accountable and transparent.</p>
      </div>
      <CitizenReportForm prefillProjectId={prefillProjectId} />
    </div>
  );
}
