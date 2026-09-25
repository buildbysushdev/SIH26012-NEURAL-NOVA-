import { useEffect, useState } from "react";
import {
  User,
  Bell,
  LayoutDashboard,
  Palette,
  Save,
  Moon,
  Sun,
  ShieldCheck,
  MapPin,
  Check,
} from "lucide-react";
import Card from "../components/ui/Card";
import Select from "../components/ui/Select";
import Button from "../components/ui/Button";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

interface SettingsState {
  emailNotifications: boolean;
  criticalAlerts: boolean;
  citizenReportNotifications: boolean;
  defaultView: string;
  rowsPerPage: string;
  theme: "Light" | "Dark";
  compactMode: boolean;
}

const DEFAULTS: SettingsState = {
  emailNotifications: true,
  criticalAlerts: true,
  citizenReportNotifications: false,
  defaultView: "Dashboard",
  rowsPerPage: "10",
  theme: "Light",
  compactMode: false,
};

const STORAGE_KEY = "mplads_settings";

function Toggle({
  checked,
  onChange,
  label,
  description,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
}) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-100 dark:border-navy-800 last:border-0">
      <div className="pr-4">
        <p className="text-xs font-semibold text-gray-800 dark:text-gray-200">{label}</p>
        {description && <p className="text-[11px] text-gray-500 dark:text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full relative transition-colors shrink-0 focus:outline-none focus:ring-2 focus:ring-[#0b2545] dark:focus:ring-amber-400 ${
          checked ? "bg-[#0b2545] dark:bg-amber-500" : "bg-gray-300 dark:bg-navy-700"
        }`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white dark:bg-navy-950 rounded-full shadow transition-transform ${
            checked ? "translate-x-5" : "translate-x-0.5"
          }`}
        />
      </button>
    </div>
  );
}

export default function Settings() {
  const { user } = useAuth();
  const { showToast } = useToast();
  const isOfficer = user?.role === "officer";

  const [settings, setSettings] = useState<SettingsState>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        return { ...DEFAULTS, ...parsed };
      } catch {}
    }
    const savedTheme = (localStorage.getItem("mplads_theme") as "Light" | "Dark") || "Light";
    return { ...DEFAULTS, theme: savedTheme };
  });

  useEffect(() => {
    // Sync dark mode class on initial mount and theme change
    if (settings.theme === "Dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
    }
  }, [settings.theme]);

  function update<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setSettings((prev) => {
      const next = { ...prev, [key]: value };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));

      if (key === "theme") {
        const t = value as "Light" | "Dark";
        localStorage.setItem("mplads_theme", t);
        if (t === "Dark") {
          document.documentElement.classList.add("dark");
        } else {
          document.documentElement.classList.remove("dark");
        }
      }
      return next;
    });
  }

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    localStorage.setItem("mplads_theme", settings.theme);
    showToast("Preferences saved and synchronized successfully.", "success");
  }

  const initials = user?.name
    ? user.name
        .split(" ")
        .map((n) => n[0])
        .join("")
        .slice(0, 2)
        .toUpperCase()
    : "OF";

  return (
    <div className="space-y-6 animate-fade-in max-w-4xl">
      {/* Header */}
      <div className="bg-white dark:bg-navy-900 border border-gray-200 dark:border-navy-800 rounded-md p-4 sm:p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <User size={18} className="text-[#0b2545] dark:text-amber-400" />
            <h1 className="text-lg sm:text-xl font-bold text-gray-900 dark:text-gray-100">
              System Settings & Profile · सेटिंग्स
            </h1>
          </div>
          <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
            Display-only authenticated credentials and configurable operational preferences
          </p>
        </div>
        <Button icon={<Save size={15} />} onClick={handleSave}>
          Save Preferences
        </Button>
      </div>

      {/* SECTION 1H: Display-Only Profile (Name, Email, Designation, Photo — Non-editable) */}
      <Card>
        <div className="flex items-center justify-between pb-3 border-b border-gray-100 dark:border-navy-800 mb-4">
          <div className="flex items-center gap-2">
            <ShieldCheck size={17} className="text-[#0b2545] dark:text-amber-400" />
            <h2 className="font-bold text-sm text-gray-900 dark:text-gray-100 uppercase tracking-wide">
              Official Personnel Profile · प्रोफाइल
            </h2>
          </div>
          <span className="text-[10px] font-semibold text-gray-500 dark:text-gray-400 bg-gray-100 dark:bg-navy-800 px-2 py-0.5 rounded">
            Display Only · Non-Editable
          </span>
        </div>

        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-5">
          {/* Photo / Avatar Placeholder */}
          <div className="relative shrink-0">
            <div className="w-20 h-20 rounded-full bg-[#0b2545] text-amber-300 flex items-center justify-center text-xl font-black border-2 border-amber-500/40 shadow-sm">
              {initials}
            </div>
            <div
              className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-emerald-600 border-2 border-white dark:border-navy-900 flex items-center justify-center text-white"
              title="Official Verified ID"
            >
              <Check size={12} />
            </div>
          </div>

          {/* Profile Fields (Display Only Cards) */}
          <div className="flex-1 w-full grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
            <div className="p-2.5 rounded bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Full Name</span>
              <p className="font-bold text-gray-900 dark:text-gray-100 mt-0.5">{user?.name || "Official User"}</p>
            </div>

            <div className="p-2.5 rounded bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Official Email</span>
              <p className="font-mono text-gray-800 dark:text-gray-200 mt-0.5 truncate">{user?.email || "—"}</p>
            </div>

            <div className="p-2.5 rounded bg-gray-50 dark:bg-navy-950 border border-gray-200 dark:border-navy-800">
              <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">Designation / Role</span>
              <p className="font-bold text-[#0b2545] dark:text-amber-400 mt-0.5">
                {user?.title || (user?.role === "super_admin" ? "Super Administrator" : "District Monitoring Officer")}
              </p>
            </div>

            {/* Jurisdiction / State Assigned field: OFFICER ONLY! (Section 1H & 2H) */}
            {isOfficer && (
              <div className="p-2.5 rounded bg-amber-50/60 dark:bg-navy-950 border border-amber-200 dark:border-navy-700">
                <span className="text-[10px] font-bold text-amber-800 dark:text-amber-400 uppercase tracking-wider flex items-center gap-1">
                  <MapPin size={11} /> Jurisdiction / Assigned State
                </span>
                <p className="font-bold text-gray-900 dark:text-gray-100 mt-0.5">
                  {user?.assignedState || user?.jurisdiction || "Assigned State"}
                </p>
              </div>
            )}
          </div>
        </div>
      </Card>

      {/* Notifications Preferences */}
      <Card>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-navy-800">
          <Bell size={17} className="text-[#0b2545] dark:text-amber-400" />
          <h2 className="font-bold text-sm text-gray-900 dark:text-gray-100 uppercase tracking-wide">
            Notification Alerts · सूचना प्राथमिकताएँ
          </h2>
        </div>

        <Toggle
          checked={settings.emailNotifications}
          onChange={(v) => update("emailNotifications", v)}
          label="Email Dispatch for Daily Compliance Summaries"
          description="Send statutory daily digest of flagged projects and anomalies to verified government inbox."
        />
        <Toggle
          checked={settings.criticalAlerts}
          onChange={(v) => update("criticalAlerts", v)}
          label="Instant Critical Risk Notifications"
          description="Send immediate high-priority alerts when cost deviations exceed 30% or duplicate work is flagged."
        />
        <Toggle
          checked={settings.citizenReportNotifications}
          onChange={(v) => update("citizenReportNotifications", v)}
          label="Citizen Signal & Public Grievance Alerts"
          description="Notify when a new public citizen report or photo proof is uploaded in jurisdiction."
        />
      </Card>

      {/* Display & Theme Preferences */}
      <Card>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-navy-800">
          <Palette size={17} className="text-[#0b2545] dark:text-amber-400" />
          <h2 className="font-bold text-sm text-gray-900 dark:text-gray-100 uppercase tracking-wide">
            Display Preferences · दृश्य प्रारूप
          </h2>
        </div>

        <div className="space-y-4">
          {/* Theme Selector (Light / Dark) */}
          <div>
            <label className="block text-xs font-semibold text-gray-700 dark:text-gray-300 mb-2">
              Color Theme Mode (Dark Mode Support)
            </label>
            <div className="grid grid-cols-2 gap-3 max-w-sm">
              <button
                type="button"
                onClick={() => update("theme", "Light")}
                className={`flex items-center justify-center gap-2 p-2.5 rounded border text-xs font-semibold transition-all ${
                  settings.theme === "Light"
                    ? "border-[#0b2545] bg-navy-50 text-[#0b2545] shadow-sm font-bold"
                    : "border-gray-200 dark:border-navy-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-800"
                }`}
              >
                <Sun size={15} /> Light Portal
              </button>
              <button
                type="button"
                onClick={() => update("theme", "Dark")}
                className={`flex items-center justify-center gap-2 p-2.5 rounded border text-xs font-semibold transition-all ${
                  settings.theme === "Dark"
                    ? "border-amber-400 bg-navy-950 text-amber-400 shadow-sm font-bold"
                    : "border-gray-200 dark:border-navy-700 text-gray-600 dark:text-gray-300 hover:bg-gray-50 dark:hover:bg-navy-800"
                }`}
              >
                <Moon size={15} /> Dark Mode
              </button>
            </div>
          </div>

          <Toggle
            checked={settings.compactMode}
            onChange={(v) => update("compactMode", v)}
            label="Compact Data Grid Density"
            description="Reduce row padding in tabular registers to display more statutory records per screen."
          />
        </div>
      </Card>

      {/* Dashboard Operational Preferences */}
      <Card>
        <div className="flex items-center gap-2 mb-3 pb-2 border-b border-gray-100 dark:border-navy-800">
          <LayoutDashboard size={17} className="text-[#0b2545] dark:text-amber-400" />
          <h2 className="font-bold text-sm text-gray-900 dark:text-gray-100 uppercase tracking-wide">
            Dashboard Defaults · डैशबोर्ड वरीयता
          </h2>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Default Portal Landing View"
            options={["Dashboard", "Projects", "Alerts", "Analytics"].map((v) => ({ value: v, label: v }))}
            value={settings.defaultView}
            onChange={(e) => update("defaultView", e.target.value)}
          />
          <Select
            label="Default Rows Per Table Page"
            options={["10", "20", "50", "100"].map((v) => ({ value: v, label: v }))}
            value={settings.rowsPerPage}
            onChange={(e) => update("rowsPerPage", e.target.value)}
          />
        </div>
      </Card>
    </div>
  );
}
