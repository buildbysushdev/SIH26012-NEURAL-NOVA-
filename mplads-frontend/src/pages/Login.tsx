import { useState, useEffect, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import {
  Lock,
  ShieldCheck,
  Eye,
  EyeOff,
  RotateCw,
  ArrowRight,
  Info,
  Landmark,
  CheckCircle2,
} from "lucide-react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { IndianFlag, OfficialMinistryEmblem } from "../components/layout/Header";
import { formatIST } from "../lib/istTime";

type RoleType = "officer" | "admin";

interface DemoPreset {
  role: RoleType;
  id: string;
  email: string;
  name: string;
  district: string;
  password: string;
  badgeLabel: string;
}

const DEMO_PRESETS: DemoPreset[] = [
  {
    role: "officer",
    id: "OFFICER-MH-01",
    email: "collector-pune@mplads.gov.in",
    name: "Dr. Rajesh Patil, IAS (District Collector & Nodal Officer)",
    district: "PUNE, MAHARASHTRA",
    password: "officer@SIH2026",
    badgeLabel: "Maharashtra (OFFICER-MH-01)",
  },
  {
    role: "officer",
    id: "STATE-MH-NODAL",
    email: "state-mh-nodal@mplads.gov.in",
    name: "Shri Anil Deshmukh (Secretary, Planning Dept)",
    district: "MAHARASHTRA (STATEWIDE)",
    password: "state@SIH2026",
    badgeLabel: "MH Nodal (STATE-MH-NODAL)",
  },
  {
    role: "admin",
    id: "ADMIN-NEURAL-NOVA",
    email: "admin@mplads.gov.in",
    name: "P. Sharma, IAS (Joint Secretary, MoSPI)",
    district: "PAN-INDIA",
    password: "admin@SIH2026",
    badgeLabel: "Super Admin (ADMIN-NEURAL-NOVA)",
  },
  {
    role: "officer",
    id: "OFFICER-DELHI-01",
    email: "officer1@mplads.ai",
    name: "Sanjay Kumar, IAS (Divisional Commissioner)",
    district: "DELHI",
    password: "officer@SIH2026",
    badgeLabel: "Delhi (OFFICER-DELHI-01)",
  },
  {
    role: "officer",
    id: "OFFICER-KA-01",
    email: "dc-dharwad@mplads.gov.in",
    name: "Manjunath Prasad, IAS (Deputy Commissioner)",
    district: "DHARWAD, KARNATAKA",
    password: "officer@SIH2026",
    badgeLabel: "Karnataka (OFFICER-KA-01)",
  },
];

function generateCaptchaCode(): string {
  const chars = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";
  let code = "";
  for (let i = 0; i < 5; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export default function Login() {
  const navigate = useNavigate();
  const { loginOfficer, loginSuperAdmin } = useAuth();
  const { showToast } = useToast();

  const [role, setRole] = useState<RoleType>("officer");
  const [badgeId, setBadgeId] = useState("OFFICER-MH-01");
  const [password, setPassword] = useState("officer@SIH2026");
  const [selectedDistrict, setSelectedDistrict] = useState("PUNE, MAHARASHTRA");
  const [showPassword, setShowPassword] = useState(false);

  // Captcha state — prefilled by default with 8FK92 so users can log in with 1 click
  const [captchaCode, setCaptchaCode] = useState("8FK92");
  const [captchaInput, setCaptchaInput] = useState("8FK92");

  const [errors, setErrors] = useState<{
    badgeId?: string;
    password?: string;
    captcha?: string;
    form?: string;
  }>({});
  const [loading, setLoading] = useState(false);

  // Live ticking IST clock
  const [liveIST, setLiveIST] = useState(formatIST);
  useEffect(() => {
    const timer = setInterval(() => {
      setLiveIST(formatIST());
    }, 1000);
    return () => clearInterval(timer);
  }, []);

  // Split formatted IST into date & time components for header display
  const istParts = liveIST.split(" | ");
  const currentDate = istParts[0] || "Fri, 25 Sept, 2026";
  const currentTime = istParts[1] || "03:50:13 pm IST";

  function handleRoleSwitch(newRole: RoleType) {
    setRole(newRole);
    setErrors({});
    if (newRole === "officer") {
      setBadgeId("OFFICER-MH-01");
      setPassword("officer@SIH2026");
      setSelectedDistrict("PUNE, MAHARASHTRA");
    } else {
      setBadgeId("ADMIN-NEURAL-NOVA");
      setPassword("admin@SIH2026");
      setSelectedDistrict("PAN-INDIA");
    }
    setCaptchaInput(captchaCode);
  }

  function handlePresetSelect(preset: DemoPreset) {
    setRole(preset.role);
    setBadgeId(preset.id);
    setPassword(preset.password);
    setSelectedDistrict(preset.district);
    setCaptchaInput(captchaCode);
    setErrors({});
    showToast(`Loaded credentials for ${preset.name}`, "info");
  }

  function handleReloadCaptcha() {
    const newCode = generateCaptchaCode();
    setCaptchaCode(newCode);
    setCaptchaInput(newCode);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    const newErrors: typeof errors = {};

    if (!badgeId.trim()) {
      newErrors.badgeId = role === "admin" ? "Admin ID is required." : "Officer ID / Badge Number is required.";
    }
    if (!password) {
      newErrors.password = "Password / Security Key is required.";
    }
    if (!captchaInput.trim() || captchaInput.trim().toUpperCase() !== captchaCode.toUpperCase()) {
      newErrors.captcha = "Security verification code does not match.";
    }

    setErrors(newErrors);
    if (Object.keys(newErrors).length > 0) return;

    setLoading(true);
    const res =
      role === "admin"
        ? await loginSuperAdmin(badgeId, password)
        : await loginOfficer(badgeId, password);
    setLoading(false);

    if (res.success) {
      showToast("Identity verified. Redirecting to portal.", "success");
      navigate(role === "admin" ? "/admin/dashboard" : "/dashboard");
    } else {
      setErrors({ form: res.error || "Authentication failed. Please verify credentials." });
    }
  }

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6f9] text-gray-900 font-sans select-text">
      {/* ─────────────────────────────────────────────────────────────
          1. TOP UTILITY BAR (Pure White with subtle bottom border)
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full bg-white border-b border-gray-200 text-[11px] sm:text-xs text-gray-700 py-1.5 px-3 sm:px-6">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          {/* Left: भारत सरकार | Government of India | live IST clock */}
          <div className="flex items-center gap-2 sm:gap-2.5 font-medium">
            <span className="font-bold text-[#0b2545]">भारत सरकार</span>
            <span className="text-gray-300">|</span>
            <span className="font-semibold text-gray-900">Government of India</span>
            <span className="text-gray-300 hidden sm:inline">|</span>
            <span className="text-gray-600 hidden sm:inline">{liveIST}</span>
          </div>

          {/* Right: A- A A+ | हिन्दी / English */}
          <div className="flex items-center gap-2.5 sm:gap-3">
            <div className="flex items-center border border-gray-300 rounded overflow-hidden text-[10px] font-semibold bg-gray-50 shadow-2xs">
              <button
                type="button"
                onClick={() => {
                  document.documentElement.style.fontSize = "14px";
                }}
                className="px-1.5 py-0.5 hover:bg-gray-200 transition-colors"
                title="Decrease Font Size"
              >
                A-
              </button>
              <button
                type="button"
                onClick={() => {
                  document.documentElement.style.fontSize = "16px";
                }}
                className="px-1.5 py-0.5 border-x border-gray-300 hover:bg-gray-200 transition-colors"
                title="Normal Font Size"
              >
                A
              </button>
              <button
                type="button"
                onClick={() => {
                  document.documentElement.style.fontSize = "18px";
                }}
                className="px-1.5 py-0.5 hover:bg-gray-200 transition-colors"
                title="Increase Font Size"
              >
                A+
              </button>
            </div>
            <span className="text-gray-300">|</span>
            <button
              type="button"
              className="text-[#0b2545] font-semibold hover:underline cursor-pointer"
            >
              हिन्दी / English
            </button>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          2. MAIN BRAND HEADER (Pure White background, MoSPI identity)
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full bg-white border-b border-gray-200 py-3 sm:py-3.5 px-3 sm:px-6 shadow-xs">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 sm:gap-4">
          {/* Left: Ashoka Lion Capital + Swoosh Graphic + Ministry Identity */}
          <div className="flex items-center gap-3 shrink-0">
            <OfficialMinistryEmblem className="h-12 sm:h-13" />

            <div>
              <h1 className="text-xs sm:text-[14px] md:text-[15px] font-bold text-[#0b2545] leading-tight tracking-tight">
                सांख्यिकी और कार्यक्रम कार्यान्वयन मंत्रालय
              </h1>
              <h2 className="text-xs sm:text-[14px] md:text-[15px] font-bold text-gray-900 leading-tight tracking-tight mt-0.5">
                Ministry of Statistics &amp; Programme Implementation
              </h2>
              <p className="text-[10px] sm:text-xs font-semibold text-[#0056b3] mt-0.5">
                MPLADS Risk Intelligence &amp; Audit Decision Support System (SIH26102)
              </p>
            </div>
          </div>

          {/* Right: National Portal Standard, Date/Time, Flag, NIC SECURE ACCESS */}
          <div className="flex items-center gap-3 sm:gap-4 shrink-0">
            <div className="hidden lg:block text-right leading-tight">
              <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest">
                NATIONAL PORTAL STANDARD
              </p>
              <p className="text-xs font-semibold text-gray-800 mt-0.5">{currentDate}</p>
              <p className="text-xs font-bold text-[#0b2545]">{currentTime}</p>
            </div>

            {/* Indian Flag */}
            <div className="hidden sm:block rounded border border-gray-200 overflow-hidden shadow-2xs">
              <IndianFlag className="w-9 h-6 sm:w-10 sm:h-7" />
            </div>

            {/* Secure Portal badge */}
            <div className="text-center shrink-0">
              <div className="border border-[#0056b3] text-[#0056b3] bg-blue-50/60 rounded px-2 sm:px-2.5 py-1 text-[11px] sm:text-xs font-bold tracking-wide shadow-2xs">
                SECURE PORTAL
              </div>
              <p className="text-[9px] sm:text-[10px] text-gray-500 font-medium mt-0.5">
                SIH26102 Neural Nova
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          3. STATUTORY NOTICE BAR (Dark Navy #0b2545)
          ───────────────────────────────────────────────────────────── */}
      <div className="w-full bg-[#0b2545] text-white py-1.5 px-3 sm:px-6 shadow-xs">
        <div className="max-w-7xl mx-auto flex flex-wrap items-center gap-2 sm:gap-3 text-xs">
          <span className="bg-white text-[#0b2545] font-extrabold text-[10px] px-2 py-0.5 rounded uppercase tracking-wider shrink-0 shadow-xs">
            STATUTORY NOTICE
          </span>
          <span className="text-gray-100 text-[11px] sm:text-xs font-normal">
            Official Portal for DISHA Inspection Officers &amp; Central Vigilance Auditors. All access is
            logged under the Information Technology Act, 2000.
          </span>
        </div>
      </div>

      {/* ─────────────────────────────────────────────────────────────
          4. MAIN PAGE CONTENT: Centered Official Login Card
          ───────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6 md:p-8">
        <div className="w-full max-w-[500px] shadow-xl rounded-lg overflow-hidden border border-gray-300 bg-white animate-fade-in">
          {/* Card Top Banner (Dark Navy) */}
          <div className="bg-[#0b2545] px-5 py-3.5 flex items-center justify-between text-white border-b border-[#071c36]">
            <div>
              <h2 className="text-base sm:text-lg font-bold tracking-wide">
                OFFICIAL AUDITOR LOGIN
              </h2>
              <p className="text-xs text-blue-200 mt-0.5">
                आधिकारिक लेखापरीक्षक लॉगिन
              </p>
            </div>
            <div className="w-8 h-8 rounded bg-white/10 flex items-center justify-center border border-white/20">
              <Lock size={17} className="text-white" />
            </div>
          </div>

          {/* Card Body */}
          <div className="p-5 sm:p-6 space-y-4">
            {/* Role Tabs */}
            <div className="grid grid-cols-2 gap-2 p-1 bg-gray-100 rounded-md border border-gray-200">
              <button
                type="button"
                onClick={() => handleRoleSwitch("officer")}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded text-xs sm:text-sm font-semibold transition-all ${
                  role === "officer"
                    ? "bg-[#0b2545] text-white shadow-xs"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-200"
                }`}
              >
                <Landmark size={15} />
                <span>District Officer (DISHA)</span>
              </button>

              <button
                type="button"
                onClick={() => handleRoleSwitch("admin")}
                className={`flex items-center justify-center gap-2 py-2 px-3 rounded text-xs sm:text-sm font-semibold transition-all ${
                  role === "admin"
                    ? "bg-[#0b2545] text-white shadow-xs"
                    : "text-gray-700 hover:text-gray-900 hover:bg-gray-200"
                }`}
              >
                <ShieldCheck size={15} />
                <span>Super Administrator</span>
              </button>
            </div>

            {/* Jurisdiction Scope Box */}
            <div className="bg-[#f0f6ff] border border-[#c5daf7] rounded-md p-3 flex items-center justify-between gap-2 shadow-2xs">
              <div>
                <p className="text-xs sm:text-sm font-bold text-[#0b2545]">
                  {role === "officer"
                    ? "DISHA District Vigilance Officer"
                    : "MoSPI Central Vigilance Super Administrator"}
                </p>
                <p className="text-[11px] text-gray-600 mt-0.5">
                  Jurisdiction:{" "}
                  {role === "officer"
                    ? `Assigned District Only (${selectedDistrict})`
                    : "Pan-India (All 36 States & UTs)"}
                </p>
              </div>
              <span className="text-[10px] font-bold px-2 py-0.5 rounded border border-[#0056b3] text-[#0056b3] bg-white tracking-wider shrink-0 shadow-2xs">
                {role === "officer" ? "DISTRICT SCOPED" : "ALL INDIA SCOPED"}
              </span>
            </div>

            {/* Pre-filled Notice Helper Strip */}
            <div className="border border-dashed border-gray-300 bg-gray-50/80 rounded p-2.5 flex items-center justify-between text-xs">
              <span className="text-emerald-700 font-semibold flex items-center gap-1.5">
                <CheckCircle2 size={14} /> Official Credentials Pre-filled
              </span>
              <span className="text-gray-500">
                Click <strong className="text-gray-800">Sign In</strong> for instant access
              </span>
            </div>

            {/* Error Message */}
            {errors.form && (
              <div className="flex items-start gap-2 bg-red-50 border border-red-200 text-red-700 text-xs rounded p-2.5">
                <Info size={15} className="mt-0.5 shrink-0" />
                <span>{errors.form}</span>
              </div>
            )}

            {/* Login Form */}
            <form onSubmit={handleSubmit} className="space-y-3.5" noValidate>
              {/* Badge ID Input */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  {role === "admin"
                    ? "Super Administrator ID / Badge Number"
                    : "Officer ID / Badge Number"}
                </label>
                <input
                  type="text"
                  value={badgeId}
                  onChange={(e) => setBadgeId(e.target.value)}
                  placeholder={role === "admin" ? "ADMIN-NEURAL-NOVA" : "OFFICER-DELHI-01"}
                  className={`w-full px-3 py-2 text-sm font-mono border rounded focus:border-[#0b2545] focus:ring-1 focus:ring-[#0b2545] outline-none bg-white text-gray-900 shadow-2xs ${
                    errors.badgeId ? "border-red-400 bg-red-50/20" : "border-gray-300"
                  }`}
                />
                {errors.badgeId && (
                  <p className="text-red-600 text-[11px] mt-1">{errors.badgeId}</p>
                )}
              </div>

              {/* Password Input with Eye Toggle */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  {role === "admin"
                    ? "Admin Password / Master Key"
                    : "Officer Password / Security Key"}
                </label>
                <div className="relative">
                  <input
                    type={showPassword ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className={`w-full px-3 py-2 pr-10 text-sm font-mono border rounded focus:border-[#0b2545] focus:ring-1 focus:ring-[#0b2545] outline-none bg-white text-gray-900 shadow-2xs ${
                      errors.password ? "border-red-400 bg-red-50/20" : "border-gray-300"
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-2.5 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-700 cursor-pointer p-1"
                    tabIndex={-1}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-red-600 text-[11px] mt-1">{errors.password}</p>
                )}
              </div>

              {/* Security Verification Code (Captcha) */}
              <div>
                <label className="block text-xs font-bold text-gray-800 mb-1">
                  Security Verification Code (Captcha)
                </label>
                <div className="flex items-center gap-2">
                  {/* Captcha Box */}
                  <div
                    className="relative bg-gradient-to-r from-blue-50 to-indigo-50 border border-gray-300 rounded px-3 py-1.5 select-none tracking-[0.3em] font-mono text-base font-extrabold text-[#0b2545] flex items-center justify-center min-w-[110px] shadow-inner overflow-hidden"
                    title="Security Captcha Verification"
                  >
                    {/* Background hatch lines */}
                    <div
                      className="absolute inset-0 opacity-20 pointer-events-none"
                      style={{
                        backgroundImage:
                          "repeating-linear-gradient(45deg, #000 0, #000 1px, transparent 0, transparent 7px)",
                      }}
                    />
                    <span className="relative z-10">{captchaCode.split("").join(" ")}</span>
                  </div>

                  {/* Refresh Button */}
                  <button
                    type="button"
                    onClick={handleReloadCaptcha}
                    title="Reload Captcha"
                    className="p-2 border border-gray-300 rounded hover:bg-gray-100 text-gray-600 transition-colors shadow-2xs cursor-pointer"
                  >
                    <RotateCw size={15} />
                  </button>

                  {/* Captcha Input */}
                  <input
                    type="text"
                    value={captchaInput}
                    onChange={(e) => setCaptchaInput(e.target.value)}
                    placeholder="8FK92"
                    className={`flex-1 px-3 py-2 text-sm font-mono uppercase border rounded focus:border-[#0b2545] focus:ring-1 focus:ring-[#0b2545] outline-none bg-white text-gray-900 shadow-2xs ${
                      errors.captcha ? "border-red-400 bg-red-50/20" : "border-gray-300"
                    }`}
                  />
                </div>
                {errors.captcha && (
                  <p className="text-red-600 text-[11px] mt-1">{errors.captcha}</p>
                )}
              </div>

              {/* Submit Button */}
              <button
                type="submit"
                disabled={loading}
                className="w-full bg-[#0b2545] hover:bg-[#071c36] text-white py-2.5 px-4 rounded font-semibold text-sm transition-colors shadow-sm flex items-center justify-center gap-2 cursor-pointer disabled:opacity-70 mt-2"
              >
                {loading ? (
                  <span>Verifying credentials...</span>
                ) : (
                  <>
                    <span>Sign In to Secure Portal</span>
                    <ArrowRight size={16} />
                  </>
                )}
              </button>
            </form>

            {/* Quick Demo Credentials Switcher */}
            <div className="pt-3 border-t border-gray-200">
              <p className="text-[11px] font-bold text-gray-600 uppercase tracking-wider mb-2">
                Official Demo Officer Badge Profiles:
              </p>
              <div className="flex flex-wrap gap-1.5">
                {DEMO_PRESETS.map((preset) => (
                  <button
                    key={preset.id}
                    type="button"
                    onClick={() => handlePresetSelect(preset)}
                    className={`text-[11px] px-2 py-1 rounded border transition-colors cursor-pointer ${
                      badgeId === preset.id
                        ? "bg-[#0b2545] text-white border-[#0b2545] font-semibold"
                        : "bg-gray-50 border-gray-300 text-gray-700 hover:bg-gray-100"
                    }`}
                  >
                    {preset.role === "admin" ? "🛡️" : "🏛️"} {preset.badgeLabel}
                  </button>
                ))}
              </div>
            </div>

            {/* Citizen Lookup Link */}
            <div className="text-center pt-2">
              <a
                href="/portal/"
                className="text-xs font-semibold text-[#0056b3] hover:underline inline-flex items-center gap-1"
              >
                Looking for public project lookup? Continue to Citizen Portal (Voice &amp; Search) →
              </a>
            </div>
          </div>
        </div>

        {/* Footer Security Badges */}
        <div className="mt-6 text-center text-gray-500 text-[11px] space-y-1">
          <p className="font-medium text-gray-600">
            Encrypted session · Role-scoped access · Audit logging enabled
          </p>
          <p>
            Ministry of Statistics &amp; Programme Implementation (MoSPI), Government of India
          </p>
          <p className="text-gray-400">
            Smart India Hackathon 2026 · Problem Statement PS 26102 (SIH26102)
          </p>
        </div>
      </div>
    </div>
  );
}
