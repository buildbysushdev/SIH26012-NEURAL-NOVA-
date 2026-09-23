import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, Bell, Menu, ChevronRight } from "lucide-react";
import { globalSearch, getNotifications } from "../../services/api";
import type { NotificationItem } from "../../types";
import { RiskBadge } from "../ui/Badge";
import { useAuth } from "../../context/AuthContext";
import { usePortalBase } from "../../lib/usePortalBase";

export default function Header({
  title,
  breadcrumb,
  onMenuClick,
}: {
  title: string;
  breadcrumb?: string[];
  onMenuClick?: () => void;
}) {
  const navigate = useNavigate();
  const portalBase = usePortalBase();
  const { user } = useAuth();
  const initials = user?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "OF";
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<{ projects: any[]; alerts: any[] } | null>(null);
  const [showResults, setShowResults] = useState(false);
  const [showNotifs, setShowNotifs] = useState(false);
  const [notifications, setNotifications] = useState<NotificationItem[]>([]);
  const searchRef = useRef<HTMLDivElement>(null);
  const notifRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    getNotifications().then(setNotifications);
  }, []);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) setShowResults(false);
      if (notifRef.current && !notifRef.current.contains(e.target as Node)) setShowNotifs(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (query.trim().length < 2) {
      setResults(null);
      return;
    }
    const t = setTimeout(() => {
      globalSearch(query).then((r) => {
        setResults(r);
        setShowResults(true);
      });
    }, 200);
    return () => clearTimeout(t);
  }, [query]);

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <header className="h-16 shrink-0 bg-white border-b border-gray-200 flex items-center gap-3 px-4 md:px-6">
      <button onClick={onMenuClick} className="md:hidden text-gray-500 hover:text-gray-800">
        <Menu size={22} />
      </button>

      <div className="min-w-0 mr-2 hidden sm:block">
        <h1 className="text-base font-semibold text-gray-900 truncate">{title}</h1>
        {breadcrumb && (
          <div className="flex items-center gap-1 text-xs text-gray-400">
            {breadcrumb.map((b, i) => (
              <span key={i} className="flex items-center gap-1">
                {i > 0 && <ChevronRight size={11} />} {b}
              </span>
            ))}
          </div>
        )}
      </div>

      <div className="flex-1 max-w-md ml-auto relative" ref={searchRef}>
        <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => results && setShowResults(true)}
          placeholder="Search project ID, name, district, alert..."
          className="w-full rounded-lg border border-gray-300 bg-gray-50 text-sm pl-9 pr-3 py-2 outline-none focus:bg-white focus:border-navy-500 focus:ring-2 focus:ring-navy-100 transition-colors"
        />
        {showResults && results && (results.projects.length > 0 || results.alerts.length > 0) && (
          <div className="absolute top-full mt-2 left-0 right-0 bg-white border border-gray-200 rounded-lg shadow-lg max-h-96 overflow-y-auto z-30 animate-fade-in">
            {results.projects.length > 0 && (
              <div className="p-2">
                <p className="text-[11px] font-semibold text-gray-400 px-2 py-1 uppercase">Projects</p>
                {results.projects.map((p) => (
                  <button
                    key={p.id}
                    onClick={() => {
                      navigate(`${portalBase}/projects/${p.id}`);
                      setShowResults(false);
                      setQuery("");
                    }}
                    className="w-full flex items-center justify-between px-2 py-2 rounded-md hover:bg-gray-50 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 truncate">{p.name}</p>
                      <p className="text-xs text-gray-400">{p.id} • {p.district}</p>
                    </div>
                    <RiskBadge level={p.riskLevel} size="sm" />
                  </button>
                ))}
              </div>
            )}
            {results.alerts.length > 0 && (
              <div className="p-2 border-t border-gray-100">
                <p className="text-[11px] font-semibold text-gray-400 px-2 py-1 uppercase">Alerts</p>
                {results.alerts.map((a) => (
                  <button
                    key={a.id}
                    onClick={() => {
                      navigate(`${portalBase}/alerts`);
                      setShowResults(false);
                      setQuery("");
                    }}
                    className="w-full flex items-center justify-between px-2 py-2 rounded-md hover:bg-gray-50 text-left"
                  >
                    <div className="min-w-0">
                      <p className="text-sm text-gray-800 truncate">{a.type}</p>
                      <p className="text-xs text-gray-400">{a.id} • {a.projectId}</p>
                    </div>
                    <RiskBadge level={a.riskLevel} size="sm" />
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      <div className="relative" ref={notifRef}>
        <button
          onClick={() => setShowNotifs((s) => !s)}
          className="relative p-2 rounded-lg text-gray-500 hover:bg-gray-100 hover:text-gray-800"
        >
          <Bell size={18} />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full ring-2 ring-white" />
          )}
        </button>
        {showNotifs && (
          <div className="absolute right-0 top-full mt-2 w-80 bg-white border border-gray-200 rounded-lg shadow-lg z-30 animate-fade-in overflow-hidden">
            <div className="px-4 py-3 border-b border-gray-100 font-semibold text-sm text-gray-800">
              Notifications
            </div>
            <div className="max-h-80 overflow-y-auto">
              {notifications.map((n) => (
                <div key={n.id} className="px-4 py-3 border-b border-gray-50 hover:bg-gray-50 flex gap-2.5">
                  <span
                    className={`mt-1 w-2 h-2 rounded-full shrink-0 ${
                      n.type === "critical" ? "bg-red-500" : n.type === "warning" ? "bg-amber-500" : "bg-navy-400"
                    }`}
                  />
                  <div className="min-w-0">
                    <p className={`text-sm ${n.read ? "text-gray-500" : "text-gray-800 font-medium"} leading-snug`}>
                      {n.title}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{n.time}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="w-9 h-9 rounded-full bg-navy-100 text-navy-800 flex items-center justify-center text-xs font-semibold" title={user?.name}>
        {initials}
      </div>
    </header>
  );
}
