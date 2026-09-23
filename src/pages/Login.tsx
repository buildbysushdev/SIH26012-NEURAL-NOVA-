import { useState, type FormEvent } from "react";
import { useNavigate, Link } from "react-router-dom";
import { ShieldCheck, Mail, Lock, Info, ArrowRight, UserCog, Users2, Globe2, ChevronLeft } from "lucide-react";
import Button from "../components/ui/Button";
import Input from "../components/ui/Input";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";

type Mode = "select" | "officer" | "admin";

const OFFICER_DEMO_ACCOUNTS = [
  { email: "officer1@mplads.ai", password: "officer123" },
  { email: "officer2@mplads.ai", password: "officer123" },
  { email: "officer3@mplads.ai", password: "officer123" },
  { email: "officer4@mplads.ai", password: "officer123" },
];

export default function Login() {
  const navigate = useNavigate();
  const { loginOfficer, loginSuperAdmin } = useAuth();
  const { showToast } = useToast();
  const [mode, setMode] = useState<Mode>("select");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errors, setErrors] = useState<{ email?: string; password?: string; form?: string }>({});
  const [loading, setLoading] = useState(false);

  function resetForm() {
    setEmail("");
    setPassword("");
    setErrors({});
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const newErrors: typeof errors = {};
    if (!email.trim()) newErrors.email = `${mode === "admin" ? "Admin ID" : "Officer ID"} / Email is required.`;
    if (!password) newErrors.password = "Password is required.";
    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    const res = mode === "admin" ? await loginSuperAdmin(email, password) : await loginOfficer(email, password);
    setLoading(false);
    if (res.success) {
      showToast("Logged in successfully.", "success");
      navigate(mode === "admin" ? "/admin/dashboard" : "/dashboard");
    } else {
      setErrors({ form: res.error });
    }
  }

  return (
    <div className="min-h-screen flex bg-navy-950">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden bg-navy-900 flex-col justify-between p-12">
        <div className="absolute inset-0 opacity-[0.06]" style={{ backgroundImage: "radial-gradient(circle at 1px 1px, white 1px, transparent 0)", backgroundSize: "28px 28px" }} />
        <div className="relative flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-navy-700 flex items-center justify-center">
            <ShieldCheck size={22} className="text-white" />
          </div>
          <div>
            <p className="text-white font-bold text-lg">MPLADS AI</p>
            <p className="text-navy-300 text-xs">Intelligent Monitoring & Risk Analytics Platform</p>
          </div>
        </div>

        <div className="relative">
          <h2 className="text-3xl font-bold text-white leading-tight max-w-md">
            AI-assisted transparency for MPLAD Scheme implementation.
          </h2>
          <p className="text-navy-300 text-sm mt-4 max-w-md leading-relaxed">
            Detects cost anomalies, duplicate works, and delivery risks across MPLADS projects — surfacing
            patterns that require verification, not conclusions.
          </p>
          <div className="grid grid-cols-3 gap-4 mt-8 max-w-md">
            {[
              ["12,842", "Projects Monitored"],
              ["82", "High Risk Flags"],
              ["74.8%", "Fund Utilization"],
            ].map(([val, label]) => (
              <div key={label} className="border-l-2 border-navy-700 pl-3">
                <p className="text-white font-bold text-xl">{val}</p>
                <p className="text-navy-400 text-[11px] mt-0.5">{label}</p>
              </div>
            ))}
          </div>
        </div>

        <p className="relative text-navy-500 text-xs">Smart India Hackathon 2026 · Problem Statement PS 26102</p>
      </div>

      {/* Right panel */}
      <div className="flex-1 flex items-center justify-center p-6 bg-gray-50">
        <div className="w-full max-w-sm">
          <div className="lg:hidden flex items-center gap-2.5 mb-8">
            <div className="w-9 h-9 rounded-lg bg-navy-800 flex items-center justify-center">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 text-sm">MPLADS AI</p>
              <p className="text-[11px] text-gray-500">Risk & Monitoring Platform</p>
            </div>
          </div>

          {mode === "select" && (
            <div className="animate-fade-in">
              <h1 className="text-xl font-bold text-gray-900">Welcome to MPLADS AI</h1>
              <p className="text-sm text-gray-500 mt-1 mb-6">Choose how you'd like to continue.</p>

              <div className="space-y-3">
                <button
                  onClick={() => {
                    setMode("admin");
                    resetForm();
                  }}
                  className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-navy-400 hover:shadow-md transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-navy-800 text-white flex items-center justify-center shrink-0">
                    <UserCog size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">Super Admin Login</p>
                    <p className="text-xs text-gray-500">Full system-level access & management</p>
                  </div>
                  <ArrowRight size={16} className="text-gray-300 shrink-0" />
                </button>

                <button
                  onClick={() => {
                    setMode("officer");
                    resetForm();
                  }}
                  className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-navy-400 hover:shadow-md transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-navy-100 text-navy-800 flex items-center justify-center shrink-0">
                    <Users2 size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">Officer Login</p>
                    <p className="text-xs text-gray-500">Monitoring dashboard for MPLADS officers</p>
                  </div>
                  <ArrowRight size={16} className="text-gray-300 shrink-0" />
                </button>

                <button
                  onClick={() => navigate("/citizen")}
                  className="w-full flex items-center gap-3 bg-white border border-gray-200 rounded-xl p-4 text-left hover:border-navy-400 hover:shadow-md transition-all"
                >
                  <div className="w-10 h-10 rounded-lg bg-emerald-50 text-emerald-700 flex items-center justify-center shrink-0">
                    <Globe2 size={18} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-gray-900 text-sm">Continue as Citizen</p>
                    <p className="text-xs text-gray-500">Public project lookup — no login required</p>
                  </div>
                  <ArrowRight size={16} className="text-gray-300 shrink-0" />
                </button>
              </div>
            </div>
          )}

          {(mode === "officer" || mode === "admin") && (
            <div className="animate-fade-in">
              <button
                onClick={() => {
                  setMode("select");
                  resetForm();
                }}
                className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-800 mb-4"
              >
                <ChevronLeft size={14} /> Back
              </button>

              <h1 className="text-xl font-bold text-gray-900">
                {mode === "admin" ? "Super Admin Login" : "Officer Login"}
              </h1>
              <p className="text-sm text-gray-500 mt-1 mb-6">
                {mode === "admin"
                  ? "Sign in to access the system management console."
                  : "Sign in to access the monitoring dashboard."}
              </p>

              {errors.form && (
                <div className="mb-4 flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-3 py-2.5">
                  <Info size={15} className="mt-0.5 shrink-0" />
                  <span>{errors.form}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-4" noValidate>
                <Input
                  id="email"
                  label={mode === "admin" ? "Admin ID / Email" : "Officer ID / Email"}
                  type="email"
                  placeholder={mode === "admin" ? "admin@mplads.ai" : "officer1@mplads.ai"}
                  icon={<Mail size={16} />}
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={errors.email}
                />
                <Input
                  id="password"
                  label="Password"
                  type="password"
                  placeholder="••••••••"
                  icon={<Lock size={16} />}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={errors.password}
                />

                <div className="flex items-center justify-end">
                  <button type="button" className="text-xs font-medium text-navy-700 hover:underline">
                    Forgot Password?
                  </button>
                </div>

                <Button type="submit" className="w-full" size="lg" loading={loading}>
                  Login <ArrowRight size={16} />
                </Button>
              </form>

              <div className="mt-4 bg-navy-50 border border-navy-100 rounded-lg px-3 py-2.5 text-xs text-navy-700 space-y-1">
                {mode === "admin" ? (
                  <p>
                    Demo login — Email: <span className="font-semibold">admin@mplads.ai</span> · Password:{" "}
                    <span className="font-semibold">admin123</span>
                  </p>
                ) : (
                  <>
                    <p className="font-medium">Demo officer accounts (password: officer123):</p>
                    {OFFICER_DEMO_ACCOUNTS.map((a) => (
                      <p key={a.email} className="font-mono">{a.email}</p>
                    ))}
                  </>
                )}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 text-center">
                <Link to="/citizen" className="text-sm font-medium text-navy-700 hover:underline">
                  Public Project Lookup →
                </Link>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
