import { useState, type FormEvent } from "react";
import { CheckCircle2, Camera, MapPin, Send, Upload } from "lucide-react";
import Card from "../ui/Card";
import Input from "../ui/Input";
import Select from "../ui/Select";
import Button from "../ui/Button";
import { submitCitizenReport, type CitizenReportSubmission } from "../../services/api";
import { useToast } from "../../context/ToastContext";

const ISSUE_TYPES = [
  "Work not started",
  "Work incomplete",
  "Poor quality",
  "Project not found",
  "Possible duplicate work",
  "Other",
];

export default function CitizenReportForm({ prefillProjectId }: { prefillProjectId?: string }) {
  const { showToast } = useToast();
  const [projectId, setProjectId] = useState(prefillProjectId ?? "");
  const [location, setLocation] = useState("");
  const [issueType, setIssueType] = useState("");
  const [description, setDescription] = useState("");
  const [photoName, setPhotoName] = useState<string | null>(null);
  const [photoFile, setPhotoFile] = useState<File | null>(null);
  const [locating, setLocating] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState<{ id: string } | null>(null);

  function useCurrentLocation() {
    if (!navigator.geolocation) {
      showToast("Location access is not available in this browser.", "error");
      return;
    }
    setLocating(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        setLocation(`${pos.coords.latitude.toFixed(4)}, ${pos.coords.longitude.toFixed(4)}`);
        setLocating(false);
        showToast("Current location captured.", "success");
      },
      () => {
        setLocating(false);
        showToast("Unable to access your location. Please enter it manually.", "error");
      }
    );
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const newErrors: Record<string, string> = {};
    if (!projectId.trim()) newErrors.projectId = "Project ID is required.";
    if (!issueType) newErrors.issueType = "Please select an issue type.";
    if (!description.trim()) newErrors.description = "Please describe the issue.";
    if (!photoFile) newErrors.photo = "A real project-site photo is required.";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setSubmitting(true);
    const submission: CitizenReportSubmission = {
      projectId: projectId.trim(),
      location,
      issueType,
      description,
      hasPhoto: !!photoFile || !!photoName,
      photoFile,
    };
    try {
      const res = await submitCitizenReport(submission);
      setSubmitted(res);
    } catch (error) {
      showToast(error instanceof Error ? error.message : "The report could not be saved.", "error");
    } finally {
      setSubmitting(false);
    }
  }

  if (submitted) {
    return (
      <Card className="text-center py-10 animate-fade-in">
        <div className="w-14 h-14 rounded-full bg-emerald-50 text-emerald-600 flex items-center justify-center mx-auto mb-4">
          <CheckCircle2 size={28} />
        </div>
        <h3 className="text-lg font-bold text-gray-900">Report Submitted Successfully</h3>
        <p className="text-sm text-gray-500 mt-2">Your report has been recorded and will be reviewed.</p>
        <div className="inline-block mt-4 bg-navy-50 border border-navy-100 rounded-lg px-4 py-2">
          <p className="text-xs text-navy-500">Report ID</p>
          <p className="font-mono font-semibold text-navy-800">{submitted.id}</p>
        </div>
      </Card>
    );
  }

  return (
    <Card>
      <h3 className="font-semibold text-gray-900 mb-1">Report an Issue</h3>
      <p className="text-xs text-gray-500 mb-5">
        Submit information about a project you believe has an issue. Reports are reviewed by officers.
      </p>
      <form onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          label="Project ID"
          placeholder="e.g. MPL-10291"
          value={projectId}
          onChange={(e) => setProjectId(e.target.value)}
          error={errors.projectId}
        />

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Location</label>
          <div className="flex gap-2">
            <Input placeholder="Village / area name" value={location} onChange={(e) => setLocation(e.target.value)} />
            <Button type="button" variant="outline" icon={<MapPin size={15} />} loading={locating} onClick={useCurrentLocation}>
              Use Current
            </Button>
          </div>
        </div>

        <Select
          label="Issue Type"
          placeholder="Select an issue type"
          options={ISSUE_TYPES.map((t) => ({ value: t, label: t }))}
          value={issueType}
          onChange={(e) => setIssueType(e.target.value)}
        />
        {errors.issueType && <p className="text-xs text-red-600 -mt-3">{errors.issueType}</p>}

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Description</label>
          <textarea
            rows={4}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Describe what you observed at the project site..."
            className="w-full rounded-lg border border-gray-300 text-sm px-3 py-2.5 outline-none focus:border-navy-500 focus:ring-2 focus:ring-navy-100"
          />
          {errors.description && <p className="text-xs text-red-600 mt-1">{errors.description}</p>}
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Photo (required)</label>
          <label className="flex items-center gap-2 border border-dashed border-gray-300 rounded-lg px-3 py-3 text-sm text-gray-500 cursor-pointer hover:bg-gray-50">
            <Upload size={16} />
            {photoName ?? "Click to upload a photo"}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0] ?? null;
                setPhotoFile(file);
                setPhotoName(file?.name ?? null);
              }}
            />
            <Camera size={14} className="ml-auto text-gray-300" />
          </label>
          {errors.photo && <p className="text-xs text-red-600 mt-1">{errors.photo}</p>}
        </div>

        <Button type="submit" className="w-full" size="lg" icon={<Send size={15} />} loading={submitting}>
          Submit Report
        </Button>
      </form>
    </Card>
  );
}
