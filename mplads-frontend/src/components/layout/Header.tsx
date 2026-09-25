import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Search,
  Bell,
  Menu,
  Languages,
  User,
  LogOut,
  Check,
  Globe,
  Clock,
  ShieldCheck,
} from "lucide-react";
import { globalSearch, getNotifications } from "../../services/api";
import type { NotificationItem } from "../../types";
import { RiskBadge } from "../ui/Badge";
import { useAuth } from "../../context/AuthContext";
import { usePortalBase } from "../../lib/usePortalBase";
import { useToast } from "../../context/ToastContext";
import { formatIST } from "../../lib/istTime";

const INDIAN_LANGUAGES = [
  { code: "en", label: "English", native: "English", available: true },
  { code: "hi", label: "Hindi", native: "हिन्दी", available: false },
  { code: "mr", label: "Marathi", native: "मराठी", available: false },
  { code: "ta", label: "Tamil", native: "தமிழ்", available: false },
  { code: "te", label: "Telugu", native: "తెలుగు", available: false },
  { code: "bn", label: "Bengali", native: "বাংলা", available: false },
  { code: "gu", label: "Gujarati", native: "ગુજરાતી", available: false },
  { code: "kn", label: "Kannada", native: "ಕನ್ನಡ", available: false },
];

/** Authentic Mathematical 24-spoke National Flag of India */
export function IndianFlag({ className = "w-9 h-6", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 900 600"
      width="36"
      height="24"
      className={className}
      style={{ width: "2.25rem", height: "1.5rem", maxWidth: "100%", flexShrink: 0, ...style }}
      aria-label="National Flag of India"
    >
      <rect width="900" height="200" fill="#FF9933" />
      <rect y="200" width="900" height="200" fill="#FFFFFF" />
      <rect y="400" width="900" height="200" fill="#138808" />
      <circle cx="450" cy="300" r="80" fill="none" stroke="#000080" strokeWidth="10" />
      <circle cx="450" cy="300" r="16" fill="#000080" />
      {Array.from({ length: 24 }).map((_, i) => (
        <line
          key={i}
          x1="450"
          y1="300"
          x2={450 + 80 * Math.cos((i * 15 * Math.PI) / 180)}
          y2={300 + 80 * Math.sin((i * 15 * Math.PI) / 180)}
          stroke="#000080"
          strokeWidth="3.5"
        />
      ))}
    </svg>
  );
}

/** State Emblem of India (Ashoka Lion Capital with motto "सत्यमेव जयते") */
export function AshokaEmblem({ className = "w-10 h-12", style }: { className?: string; style?: React.CSSProperties }) {
  return (
    <svg
      viewBox="0 0 100 115"
      width="40"
      height="48"
      className={className}
      style={{ width: "2.5rem", height: "3rem", maxWidth: "100%", flexShrink: 0, ...style }}
      fill="currentColor"
      aria-label="National Emblem of India"
    >
      <path d="M50 8 C44 8 41 12 40 17 C39 22 41 27 42 32 C43 36 44 40 45 44 C47 43 49 42 50 42 C51 42 53 43 55 44 C56 40 57 36 58 32 C59 27 61 22 60 17 C59 12 56 8 50 8 Z" className="text-[#0b2545]" />
      <path d="M46 19 C48 18 52 18 54 19 M47 24 C49 23 51 23 53 24 M48 29 L52 29 M47 34 C49 35 51 35 53 34 M45 37 L55 37" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" className="text-amber-600/80" />
      <path d="M38 16 C34 16 30 19 28 23 C26 27 26 33 28 37 C29 40 31 43 33 46 C36 44 38 43 41 42 C39 37 38 32 38 27 C38 23 38 19 38 16 Z" className="text-[#0b2545]" />
      <path d="M31 23 C33 25 35 27 36 29 M30 29 C32 31 34 33 35 36" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-amber-600/80" />
      <path d="M62 16 C66 16 70 19 72 23 C74 27 74 33 72 37 C71 40 69 43 67 46 C64 44 62 43 59 42 C61 37 62 32 62 27 C62 23 62 19 62 16 Z" className="text-[#0b2545]" />
      <path d="M69 23 C67 25 65 27 64 29 M70 29 C68 31 66 33 65 36" stroke="currentColor" strokeWidth="1" strokeLinecap="round" className="text-amber-600/80" />
      <rect x="22" y="46" width="56" height="12" rx="2" className="text-[#0b2545]" />
      <circle cx="50" cy="52" r="4.5" stroke="currentColor" strokeWidth="1.2" fill="none" className="text-[#0056b3]" />
      <circle cx="50" cy="52" r="1.2" className="text-[#0056b3]" />
      <line x1="50" y1="47.5" x2="50" y2="56.5" stroke="currentColor" strokeWidth="0.8" className="text-[#0056b3]" />
      <line x1="45.5" y1="52" x2="54.5" y2="52" stroke="currentColor" strokeWidth="0.8" className="text-[#0056b3]" />
      <line x1="46.8" y1="48.8" x2="53.2" y2="55.2" stroke="currentColor" strokeWidth="0.8" className="text-[#0056b3]" />
      <line x1="46.8" y1="55.2" x2="53.2" y2="48.8" stroke="currentColor" strokeWidth="0.8" className="text-[#0056b3]" />
      <path d="M28 50 C29 48 32 49 34 52 C33 54 31 55 29 54 Z" fill="currentColor" className="text-amber-300" />
      <path d="M66 52 C68 49 71 48 72 50 C70 54 68 55 66 52 Z" fill="currentColor" className="text-amber-300" />
      <path d="M26 60 C32 66 42 68 50 68 C58 68 68 66 74 60 C66 63 58 64 50 64 C42 64 34 63 26 60 Z" className="text-[#0b2545]" />
      <rect x="20" y="69" width="60" height="3" rx="1" className="text-[#0b2545]" />
      <text x="50" y="83" textAnchor="middle" fontSize="9.5" fontWeight="bold" fontFamily="serif" letterSpacing="0.05em" className="fill-[#0b2545]">
        सत्यमेव जयते
      </text>
    </svg>
  );
}

/** MoSPI Ministry Emblem export */
export function OfficialMinistryEmblem({ className = "h-12" }: { className?: string }) {
  return (
    <div className={`flex items-center gap-1.5 shrink-0 ${className}`}>
      <AshokaEmblem className="w-10 h-12 shrink-0" />
      <svg viewBox="0 0 24 50" width="16" height="44" className="w-3.5 sm:w-4 h-10 sm:h-11 shrink-0" fill="none" aria-hidden="true">
        <path d="M 4 8 C 12 16, 20 22, 20 30" stroke="#FF9933" strokeWidth="3.2" strokeLinecap="round" />
        <path d="M 2 24 C 10 32, 16 38, 16 46" stroke="#138808" strokeWidth="3.2" strokeLinecap="round" />
      </svg>
    </div>
  );
}

export default function Header({
  title,
  onMenuClick,
}: {
  title?: string;
  breadcrumb?: string[];
  onMenuClick?: () => void;
}) {
  const navigate = useNavigate();
  const portalBase = usePortalBase();
  const { user, logout } = useAuth();
  const { showToast } = useToast();

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ projects: any[]; alerts: any[] } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [showProfileMenu, setShowProfileMenu] = useState(false);
  const [showLangMenu, setShowLangMenu] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const [currentLang, setCurrentLang] = useState(() => localStorage.getItem("mplads_lang") || "en");
  const [istTime, setIstTime] = useState(formatIST);

  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);
  const profileRef = useRef<HTMLDivElement>(null);
  const langRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const timer = setInterval(() => setIstTime(formatIST()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => { getNotifications().then(setNotifications); }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
      if (profileRef.current && !profileRef.current.contains(e.target as Node)) setShowProfileMenu(false);
      if (langRef.current && !langRef.current.contains(e.target as Node)) setShowLangMenu(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) { setResults(null); return; }
    const t = setTimeout(() => {
      globalSearch(query).then((r) => { setResults(r); setShowResults(true); });
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  function handleLanguageSelect(code: string, label: string, isAvailable: boolean) {
    setCurrentLang(code);
    localStorage.setItem("mplads_lang", code);
    setShowLangMenu(false);
    if (!isAvailable) {
      showToast(`${label} translation coming soon. System interface is currently active in English.`, "info");
    } else {
      showToast("Language set to English.", "success");
    }
  }

  function adjustFontSize(action: "decrease" | "normal" | "increase") {
    const root = document.documentElement;
    if (action === "decrease") { root.style.fontSize = "92%"; showToast("Font size: A- (92%)", "info"); }
    else if (action === "increase") { root.style.fontSize = "108%"; showToast("Font size: A+ (108%)", "info"); }
    else { root.style.fontSize = "100%"; showToast("Font size: A (100%)", "info"); }
  }

  const unreadCount = notifications.filter((n) => !n.read).length;
  const initials = user?.name
    ? user.name.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase()
    : "OF";
  const isAdmin = user?.role === "super_admin" || portalBase.includes("admin");
  const jurisdictionText = isAdmin
    ? "All India"
    : `${user?.assignedState || user?.jurisdiction || "State Scoped"} (State Scoped)`;

  // suppress title if not used to avoid TS warning
  void title;

  return (
    <div className="w-full shrink-0 flex flex-col bg-white text-gray-900 border-b border-gray-200 z-30 shadow-sm">

      {/* ── 1. TOP UTILITY BAR ── light gray, compact ── */}
      <div className="w-full bg-[#f0f2f5] text-gray-700 text-[11px] border-b border-gray-200 select-none">
        <div className="max-w-7xl mx-auto px-3 sm:px-6 h-7 flex items-center justify-between gap-3">
          <div className="flex items-center gap-1.5 shrink-0">
            <span className="font-bold text-gray-900 tracking-wide">भारत सरकार</span>
            <span className="text-gray-400">|</span>
            <span className="font-semibold tracking-wide hidden sm:inline">Government of India</span>
            <span className="font-semibold tracking-wide sm:hidden">GOI</span>
          </div>
          <div className="flex items-center gap-1.5 font-medium text-gray-700">
            <Clock size={11} className="hidden sm:inline shrink-0 text-[#0b2545]" />
            <span>{istTime}</span>
          </div>
          <div className="flex items-center gap-2 shrink-0">
            <div className="flex items-center gap-0.5 text-[11px] font-bold text-gray-600">
              <button onClick={() => adjustFontSize("decrease")} className="px-1 py-0.5 hover:text-[#0b2545] transition-colors" title="Decrease font size">A-</button>
              <button onClick={() => adjustFontSize("normal")} className="px-1 py-0.5 hover:text-[#0b2545] transition-colors" title="Reset font size">A</button>
              <button onClick={() => adjustFontSize("increase")} className="px-1 py-0.5 hover:text-[#0b2545] transition-colors" title="Increase font size">A+</button>
            </div>
            <span className="text-gray-300">|</span>
            <button
              onClick={() => {
                const nextLang = currentLang === "hi" ? "en" : "hi";
                handleLanguageSelect(nextLang, nextLang === "en" ? "English" : "Hindi", nextLang === "en");
              }}
              className="text-[11px] font-semibold text-[#0056b3] hover:underline"
              title="Toggle Hindi / English"
            >
              हिन्दी / English
            </button>
          </div>
        </div>
      </div>

      {/* ── 2. MAIN HEADER BAND ── pure white, MoSPI identity ── */}
      <div className="w-full bg-white">
        <header className="max-w-7xl mx-auto px-3 sm:px-6 py-2 sm:py-2.5 flex items-center justify-between gap-3">

          {/* LEFT: mobile menu + emblem + ministry name */}
          <div className="flex items-center gap-2 sm:gap-3 shrink-0">
            {onMenuClick && (
              <button onClick={onMenuClick} className="lg:hidden p-1.5 rounded text-gray-600 hover:bg-gray-100 hover:text-[#0b2545]" aria-label="Toggle menu">
                <Menu size={20} />
              </button>
            )}
            <div
              onClick={() => navigate(user?.role === "super_admin" ? "/admin/dashboard" : "/dashboard")}
              className="flex items-center gap-2 sm:gap-2.5 cursor-pointer select-none group"
              title="MoSPI — MPLADS Portal"
            >
              <div className="shrink-0 group-hover:opacity-90 transition-opacity">
                <AshokaEmblem className="w-9 h-11 sm:w-10 sm:h-12" />
              </div>
              <div className="flex flex-col w-1 h-10 rounded-full overflow-hidden shrink-0">
                <div className="flex-1 bg-[#FF9933]" />
                <div className="flex-1 bg-white border-y border-gray-200" />
                <div className="flex-1 bg-[#138808]" />
              </div>
              <div className="min-w-0">
                <div className="text-[11px] sm:text-[13px] font-bold text-[#0b2545] leading-tight tracking-tight">
                  सांख्यिकी और कार्यक्रम कार्यान्वयन मंत्रालय
                </div>
                <div className="text-[11px] sm:text-[13px] font-bold text-gray-900 leading-tight tracking-tight mt-px">
                  Ministry of Statistics &amp; Programme Implementation
                </div>
                <div className="text-[10px] sm:text-[11px] font-semibold text-[#0056b3] tracking-wide mt-0.5">
                  MPLADS Risk Intelligence &amp; Audit Decision Support System (SIH26102)
                </div>
              </div>
            </div>
          </div>

          {/* CENTER: Search */}
          <div className="flex-1 max-w-xs lg:max-w-sm mx-2 relative hidden md:block" ref={searchRef}>
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onFocus={() => results && setShowResults(true)}
              placeholder="Search project ID, name, district..."
              className="w-full rounded border border-gray-300 bg-gray-50 text-gray-900 text-xs pl-8 pr-3 py-1.5 outline-none focus:bg-white focus:border-[#0b2545] focus:ring-1 focus:ring-[#0b2545]/20 transition-colors"
            />
            {showResults && results && (results.projects.length > 0 || results.alerts.length > 0) && (
              <div className="absolute top-full mt-1 left-0 right-0 bg-white border border-gray-200 rounded-md shadow-xl max-h-80 overflow-y-auto z-50 animate-fade-in">
                {results.projects.length > 0 && (
                  <div className="p-2">
                    <p className="text-[10px] font-semibold text-gray-400 px-2 py-1 uppercase tracking-wider">Projects</p>
                    {results.projects.map((p) => (
                      <button key={p.id} onClick={() => { navigate(`${portalBase}/projects/${p.id}`); setShowResults(false); setQuery(""); }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-gray-50 text-left transition-colors">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-medium text-gray-800 truncate">{p.name}</p>
                          <p className="text-[11px] text-gray-500">{p.id} · {p.district}, {p.state}</p>
                        </div>
                        <RiskBadge level={p.riskLevel} size="sm" />
                      </button>
                    ))}
                  </div>
                )}
                {results.alerts.length > 0 && (
                  <div className="p-2 border-t border-gray-100">
                    <p className="text-[10px] font-semibold text-gray-400 px-2 py-1 uppercase tracking-wider">Alerts</p>
                    {results.alerts.map((a) => (
                      <button key={a.id} onClick={() => { navigate(`${portalBase}/alerts`); setShowResults(false); setQuery(""); }}
                        className="w-full flex items-center justify-between px-2.5 py-1.5 rounded hover:bg-gray-50 text-left transition-colors">
                        <div className="min-w-0 pr-2">
                          <p className="text-xs font-medium text-gray-800 truncate">{a.type}</p>
                          <p className="text-[11px] text-gray-500">{a.id} · {a.projectId}</p>
                        </div>
                        <RiskBadge level={a.riskLevel} size="sm" />
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* RIGHT: Flag + Language + Bell + Compact Profile */}
          <div className="flex items-center gap-1.5 sm:gap-2 shrink-0">

            {/* Indian Flag — xl only */}
            <div className="hidden xl:flex items-center gap-2 border-r border-gray-200 pr-3 mr-1">
              <div className="text-right">
                <p className="text-[9px] font-bold text-gray-400 uppercase tracking-widest leading-none">National Portal</p>
                <p className="text-[10px] font-semibold text-gray-600 mt-px">MoSPI DISHA</p>
              </div>
              <div className="rounded border border-gray-200 overflow-hidden shrink-0">
                <IndianFlag className="w-8 h-5" />
              </div>
            </div>

            {/* Language switcher */}
            <div className="relative" ref={langRef}>
              <button
                onClick={() => setShowLangMenu((v) => !v)}
                className="flex items-center gap-1.5 px-2 py-1.5 rounded border border-gray-300 bg-white text-gray-700 text-xs font-semibold hover:bg-gray-50 transition-colors"
                title="Select Portal Language"
              >
                <Languages size={14} className="text-[#0b2545] shrink-0" />
                <span className="hidden sm:inline">{INDIAN_LANGUAGES.find((l) => l.code === currentLang)?.label || "English"}</span>
              </button>
              {showLangMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-52 bg-white border border-gray-200 rounded-md shadow-xl z-50 animate-fade-in py-1">
                  <div className="px-3 py-1.5 border-b border-gray-100">
                    <span className="text-[11px] font-semibold text-gray-400 uppercase tracking-wider flex items-center gap-1">
                      <Globe size={11} /> Language / भाषा
                    </span>
                  </div>
                  <div className="max-h-52 overflow-y-auto py-1">
                    {INDIAN_LANGUAGES.map((lang) => (
                      <button
                        key={lang.code}
                        onClick={() => handleLanguageSelect(lang.code, lang.label, lang.available)}
                        className={`w-full flex items-center justify-between px-3 py-1.5 text-xs text-left transition-colors ${
                          currentLang === lang.code ? "bg-[#eef2f7] text-[#0b2545] font-semibold" : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <div className="flex items-center gap-2">
                          <span>{lang.native}</span>
                          <span className="text-[11px] text-gray-400">({lang.label})</span>
                        </div>
                        {currentLang === lang.code
                          ? <Check size={12} className="text-[#0b2545]" />
                          : !lang.available
                          ? <span className="text-[9px] bg-gray-100 text-gray-500 px-1.5 py-0.5 rounded">Soon</span>
                          : null}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Bell */}
            <div className="relative" ref={notifRef}>
              <button
                onClick={() => setShowNotifs((s) => !s)}
                className="relative p-2 rounded border border-gray-300 bg-white text-gray-600 hover:bg-gray-50 hover:text-[#0b2545] transition-colors"
                title="Alerts & Notifications"
              >
                <Bell size={15} />
                {unreadCount > 0 && (
                  <span className="absolute top-1 right-1 w-2 h-2 bg-red-600 rounded-full ring-2 ring-white" />
                )}
              </button>
              {showNotifs && (
                <div className="absolute right-0 top-full mt-1.5 w-80 bg-white border border-gray-200 rounded-md shadow-xl z-50 animate-fade-in overflow-hidden">
                  <div className="px-4 py-2 bg-gray-50 border-b border-gray-200 flex items-center justify-between">
                    <span className="font-semibold text-xs text-gray-800 uppercase tracking-wider">Notifications ({notifications.length})</span>
                    <span className="text-[10px] text-gray-500">MoSPI System</span>
                  </div>
                  <div className="max-h-72 overflow-y-auto divide-y divide-gray-100">
                    {notifications.map((n) => (
                      <div key={n.id} className="p-3 hover:bg-gray-50 flex gap-2.5 transition-colors">
                        <span className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                          n.type === "critical" ? "bg-red-500" : n.type === "warning" ? "bg-amber-500" : "bg-blue-500"
                        }`} />
                        <div className="min-w-0">
                          <p className={`text-xs ${n.read ? "text-gray-500" : "text-gray-800 font-medium"} leading-snug`}>{n.title}</p>
                          <p className="text-[10px] text-gray-400 mt-1">{n.time}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* ── COMPACT PROFILE BUTTON (fixed 32×32 avatar) ── */}
            <div className="relative" ref={profileRef}>
              <button
                onClick={() => setShowProfileMenu((v) => !v)}
                className="flex items-center gap-2 pl-1.5 pr-2.5 py-1 rounded border border-gray-300 bg-white hover:bg-gray-50 transition-colors"
                title={user?.name || "Profile"}
              >
                {/* Avatar — strictly 32×32 via inline style to avoid Tailwind class issues */}
                <div className="shrink-0 rounded-full overflow-hidden border-2 border-[#0b2545]/25" style={{ width: 32, height: 32 }}>
                  {user?.avatar ? (
                    <img
                      src={user.avatar}
                      alt={user.name}
                      style={{ width: 32, height: 32, objectFit: "cover", display: "block" }}
                      onError={(e) => {
                        const el = e.currentTarget as HTMLImageElement;
                        el.style.display = "none";
                        const fb = el.nextElementSibling as HTMLElement | null;
                        if (fb) fb.style.display = "flex";
                      }}
                    />
                  ) : null}
                  <div
                    className="rounded-full bg-[#0b2545] text-amber-300 items-center justify-center text-xs font-bold"
                    style={{ width: 32, height: 32, display: user?.avatar ? "none" : "flex" }}
                  >
                    {initials}
                  </div>
                </div>
                {/* Name block */}
                <div className="hidden md:flex flex-col text-left leading-tight min-w-0">
                  <span className="text-xs font-bold text-gray-900 truncate max-w-[110px]">{user?.name ?? "User"}</span>
                  <span className="text-[10px] text-[#0056b3] font-semibold truncate max-w-[110px]">
                    {user?.title ?? (isAdmin ? "Super Admin" : "District Officer")}
                  </span>
                </div>
              </button>

              {showProfileMenu && (
                <div className="absolute right-0 top-full mt-1.5 w-60 bg-white border border-gray-200 rounded-md shadow-xl z-50 animate-fade-in py-1">
                  <div className="px-3 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-2.5">
                    <div className="shrink-0 rounded-full overflow-hidden border-2 border-[#0b2545]" style={{ width: 40, height: 40 }}>
                      {user?.avatar ? (
                        <img
                          src={user.avatar}
                          alt={user.name}
                          style={{ width: 40, height: 40, objectFit: "cover", display: "block" }}
                          onError={(e) => {
                            const el = e.currentTarget as HTMLImageElement;
                            el.style.display = "none";
                            const fb = el.nextElementSibling as HTMLElement | null;
                            if (fb) fb.style.display = "flex";
                          }}
                        />
                      ) : null}
                      <div
                        className="rounded-full bg-[#0b2545] text-amber-300 items-center justify-center font-bold text-sm"
                        style={{ width: 40, height: 40, display: user?.avatar ? "none" : "flex" }}
                      >
                        {initials}
                      </div>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-bold text-gray-900 truncate">{user?.name}</p>
                      <p className="text-[10px] text-gray-500 truncate">{user?.email}</p>
                      <p className="text-[10px] text-[#0056b3] font-semibold mt-0.5 truncate">{user?.jurisdiction || "All India"}</p>
                    </div>
                  </div>
                  <div className="py-1">
                    <button
                      onClick={() => { setShowProfileMenu(false); navigate(isAdmin ? "/admin/settings" : "/settings"); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-gray-700 hover:bg-gray-100 transition-colors text-left"
                    >
                      <User size={14} className="text-[#0b2545] shrink-0" />
                      <span>View Profile &amp; Preferences</span>
                    </button>
                    <button
                      onClick={() => { setShowProfileMenu(false); logout(); navigate("/login"); }}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-xs text-red-600 hover:bg-red-50 transition-colors text-left border-t border-gray-100"
                    >
                      <LogOut size={14} className="shrink-0" />
                      <span>Logout from Portal</span>
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>
        </header>
      </div>

      {/* ── 3. STATUTORY NOTICE BAR ── dark navy ── */}
      <div className="w-full bg-[#0b2545] text-white py-1.5 px-3 sm:px-6 shrink-0">
        <div className="max-w-7xl mx-auto flex items-center justify-between gap-3 text-[11px] leading-tight flex-wrap sm:flex-nowrap">
          <div className="flex items-center gap-2 min-w-0">
            <span className="bg-white text-[#0b2545] text-[10px] font-black px-2 py-0.5 rounded uppercase tracking-wider shrink-0">
              STATUTORY NOTICE
            </span>
            <span className="text-slate-200 truncate">
              Official Portal for DISHA Inspection Officers &amp; Central Vigilance Auditors. All access is logged under the Information Technology Act, 2000.
            </span>
          </div>
          <div className="flex items-center gap-1.5 text-amber-300 font-medium shrink-0 ml-auto sm:ml-0">
            <ShieldCheck size={13} className="shrink-0 text-emerald-400" />
            <span>Jurisdiction: <strong className="text-white font-semibold">{jurisdictionText}</strong></span>
          </div>
        </div>
      </div>
    </div>
  );
}
