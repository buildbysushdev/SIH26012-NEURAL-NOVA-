import { useEffect, useState } from "react";
import { User, Bell, LayoutDashboard, Palette, Save } from "lucide-react";
import Card from "../components/ui/Card";
import Input from "../components/ui/Input";
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
  theme: string;
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

function Toggle({ checked, onChange, label, description }: { checked: boolean; onChange: (v: boolean) => void; label: string; description?: string }) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
      <div className="pr-4">
        <p className="text-sm font-medium text-gray-800">{label}</p>
        {description && <p className="text-xs text-gray-400 mt-0.5">{description}</p>}
      </div>
      <button
        onClick={() => onChange(!checked)}
        className={`w-11 h-6 rounded-full relative transition-colors shrink-0 ${checked ? "bg-navy-800" : "bg-gray-300"}`}
      >
        <span
          className={`absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-transform ${
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
  const [settings, setSettings] = useState<SettingsState>(DEFAULTS);
  const [name, setName] = useState(user?.name ?? "");
  const [email, setEmail] = useState(user?.email ?? "");

  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) setSettings(JSON.parse(stored));
  }, []);

  function update<K extends keyof SettingsState>(key: K, value: SettingsState[K]) {
    setSettings((s) => ({ ...s, [key]: value }));
  }

  function handleSave() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
    showToast("Settings saved successfully.", "success");
  }

  return (
    <div className="space-y-6 animate-fade-in max-w-3xl">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <h2 className="text-xl font-bold text-gray-900">Settings</h2>
        <Button icon={<Save size={15} />} onClick={handleSave}>
          Save Changes
        </Button>
      </div>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <User size={16} className="text-navy-700" />
          <h3 className="font-semibold text-gray-900">Profile</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="Full Name" value={name} onChange={(e) => setName(e.target.value)} />
          <Input label="Email" value={email} onChange={(e) => setEmail(e.target.value)} disabled />
          <Input label="Role" value={user?.title ?? "District Monitoring Officer"} disabled />
          <Input label="Jurisdiction" defaultValue={user?.jurisdiction ?? "Maharashtra · All Districts"} />
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-2">
          <Bell size={16} className="text-navy-700" />
          <h3 className="font-semibold text-gray-900">Notifications</h3>
        </div>
        <Toggle
          checked={settings.emailNotifications}
          onChange={(v) => update("emailNotifications", v)}
          label="Email notifications"
          description="Receive a daily summary of activity via email."
        />
        <Toggle
          checked={settings.criticalAlerts}
          onChange={(v) => update("criticalAlerts", v)}
          label="Critical risk alerts"
          description="Get notified immediately when a project is flagged Critical risk."
        />
        <Toggle
          checked={settings.citizenReportNotifications}
          onChange={(v) => update("citizenReportNotifications", v)}
          label="Citizen report notifications"
          description="Get notified when a new citizen report is submitted."
        />
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-4">
          <LayoutDashboard size={16} className="text-navy-700" />
          <h3 className="font-semibold text-gray-900">Dashboard Preferences</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Select
            label="Default landing view"
            options={["Dashboard", "Projects", "Alerts", "Analytics"].map((v) => ({ value: v, label: v }))}
            value={settings.defaultView}
            onChange={(e) => update("defaultView", e.target.value)}
          />
          <Select
            label="Rows per page (tables)"
            options={["10", "20", "50"].map((v) => ({ value: v, label: v }))}
            value={settings.rowsPerPage}
            onChange={(e) => update("rowsPerPage", e.target.value)}
          />
        </div>
      </Card>

      <Card>
        <div className="flex items-center gap-2 mb-2">
          <Palette size={16} className="text-navy-700" />
          <h3 className="font-semibold text-gray-900">Display Preferences</h3>
        </div>
        <Select
          label="Theme"
          options={["Light", "System"].map((v) => ({ value: v, label: v }))}
          value={settings.theme}
          onChange={(e) => update("theme", e.target.value)}
        />
        <Toggle
          checked={settings.compactMode}
          onChange={(v) => update("compactMode", v)}
          label="Compact table mode"
          description="Reduce row height in data tables for denser viewing."
        />
      </Card>
    </div>
  );
}
