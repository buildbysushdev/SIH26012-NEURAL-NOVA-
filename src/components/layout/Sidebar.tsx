import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  ShieldAlert,
  Map,
  BarChart3,
  FileText,
  Settings,
  HelpCircle,
  LogOut,
  ShieldCheck,
  ChevronsLeft,
  ChevronsRight,
  Users,
  MessageSquareWarning,
  ScrollText,
} from "lucide-react";
import clsx from "clsx";
import { useAuth } from "../../context/AuthContext";

const OFFICER_NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/alerts", label: "Risk & Alerts", icon: ShieldAlert },
  { to: "/risk-map", label: "India Risk Map", icon: Map },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileText },
];

const ADMIN_NAV_ITEMS = [
  { to: "/admin/dashboard", label: "Overview", icon: LayoutDashboard },
  { to: "/admin/officers", label: "Officers", icon: Users },
  { to: "/admin/projects", label: "Projects", icon: FolderKanban },
  { to: "/admin/alerts", label: "Risk & Alerts", icon: ShieldAlert },
  { to: "/admin/risk-map", label: "India Risk Map", icon: Map },
  { to: "/admin/citizen-reports", label: "Citizen Reports", icon: MessageSquareWarning },
  { to: "/admin/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/admin/reports", label: "Reports", icon: FileText },
  { to: "/admin/audit-logs", label: "Audit Logs", icon: ScrollText },
];

export default function Sidebar({
  collapsed,
  onToggleCollapse,
  onNavigate,
  variant = "officer",
}: {
  collapsed: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  variant?: "officer" | "admin";
}) {
  const { user, logout } = useAuth();
  const navItems = variant === "admin" ? ADMIN_NAV_ITEMS : OFFICER_NAV_ITEMS;
  const settingsPath = variant === "admin" ? "/admin/settings" : "/settings";

  return (
    <aside
      className={clsx(
        "flex flex-col h-full bg-navy-900 text-navy-100 transition-all duration-200",
        collapsed ? "w-[76px]" : "w-64"
      )}
    >
      <div className="flex items-center gap-2 px-4 h-16 border-b border-navy-800 shrink-0">
        <div className="w-8 h-8 rounded-lg bg-navy-700 flex items-center justify-center shrink-0">
          <ShieldCheck size={18} className="text-white" />
        </div>
        {!collapsed && (
          <div className="min-w-0">
            <p className="text-white font-bold text-sm leading-tight truncate">MPLADS AI</p>
            <p className="text-[10px] text-navy-300 truncate">
              {variant === "admin" ? "Super Admin Console" : "Risk & Monitoring"}
            </p>
          </div>
        )}
      </div>

      <nav className="flex-1 overflow-y-auto py-4 px-2.5 space-y-1">
        {navItems.map((item) => (
          <NavLink
            key={item.to}
            to={item.to}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive ? "bg-navy-700 text-white" : "text-navy-200 hover:bg-navy-800 hover:text-white",
                collapsed && "justify-center"
              )
            }
            title={collapsed ? item.label : undefined}
          >
            <item.icon size={18} className="shrink-0" />
            {!collapsed && <span className="truncate">{item.label}</span>}
          </NavLink>
        ))}

        <div className="pt-3 mt-3 border-t border-navy-800 space-y-1">
          <NavLink
            to={settingsPath}
            onClick={onNavigate}
            className={({ isActive }) =>
              clsx(
                "flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors",
                isActive ? "bg-navy-700 text-white" : "text-navy-200 hover:bg-navy-800 hover:text-white",
                collapsed && "justify-center"
              )
            }
            title={collapsed ? "Settings" : undefined}
          >
            <Settings size={18} className="shrink-0" />
            {!collapsed && <span>Settings</span>}
          </NavLink>
          <button
            className={clsx(
              "w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-navy-200 hover:bg-navy-800 hover:text-white transition-colors",
              collapsed && "justify-center"
            )}
            title={collapsed ? "Help" : undefined}
          >
            <HelpCircle size={18} className="shrink-0" />
            {!collapsed && <span>Help</span>}
          </button>
        </div>
      </nav>

      {onToggleCollapse && (
        <button
          onClick={onToggleCollapse}
          className="hidden md:flex items-center justify-center gap-2 mx-2.5 mb-2 py-2 rounded-lg text-navy-300 hover:bg-navy-800 hover:text-white text-xs"
        >
          {collapsed ? <ChevronsRight size={16} /> : <><ChevronsLeft size={16} /> Collapse</>}
        </button>
      )}

      <div className="border-t border-navy-800 p-3">
        <div className={clsx("flex items-center gap-2.5", collapsed && "justify-center")}>
          <div className="w-9 h-9 rounded-full bg-navy-600 text-white flex items-center justify-center text-xs font-semibold shrink-0">
            {user?.name?.split(" ").map((n) => n[0]).join("").slice(0, 2).toUpperCase() ?? "OF"}
          </div>
          {!collapsed && (
            <div className="min-w-0 flex-1">
              <p className="text-xs font-semibold text-white truncate">{user?.name ?? "Officer"}</p>
              <p className="text-[10px] text-navy-300 truncate">{user?.title ?? "Monitoring Officer"}</p>
            </div>
          )}
          {!collapsed && (
            <button onClick={logout} title="Logout" className="text-navy-300 hover:text-white shrink-0">
              <LogOut size={16} />
            </button>
          )}
        </div>
      </div>
    </aside>
  );
}
