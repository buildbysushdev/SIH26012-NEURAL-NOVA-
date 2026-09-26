import { NavLink } from "react-router-dom";
import {
  LayoutDashboard,
  FolderKanban,
  ShieldAlert,
  Map,
  BarChart3,
  FileText,
  Users,
  MessageSquareWarning,
  ScrollText,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import clsx from "clsx";

const OFFICER_NAV_ITEMS = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/projects", label: "Projects", icon: FolderKanban },
  { to: "/alerts", label: "Risk & Alerts", icon: ShieldAlert },
  { to: "/risk-map", label: "State Risk Map", icon: Map },
  { to: "/analytics", label: "Analytics", icon: BarChart3 },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/workspace", label: "My Workspace", icon: Briefcase },
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
  { to: "/admin/workspace", label: "My Workspace", icon: Briefcase },
];

export default function Sidebar({
  onNavigate,
  variant = "officer",
  mobileOpen = false,
}: {
  collapsed?: boolean;
  onToggleCollapse?: () => void;
  onNavigate?: () => void;
  variant?: "officer" | "admin";
  mobileOpen?: boolean;
}) {
  const navItems = variant === "admin" ? ADMIN_NAV_ITEMS : OFFICER_NAV_ITEMS;

  return (
    <div className="w-full bg-[#0b2545] dark:bg-[#07172b] border-b border-[#081b33] dark:border-navy-950 text-white shadow-sm shrink-0">
      {/* Desktop & Tablet Horizontal Nav Strip */}
      <nav className="w-full px-3 sm:px-6 flex items-center overflow-x-auto scrollbar-none no-scrollbar">
        <div className="flex items-center space-x-0.5 sm:space-x-1 min-w-max py-0.5">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2 px-3 sm:px-3.5 py-2.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all border-b-2",
                  isActive
                    ? "border-[#FF9933] bg-[#143560] dark:bg-navy-900 text-[#FFB055] shadow-inner"
                    : "border-transparent text-slate-200 hover:text-white hover:bg-[#102e54] hover:border-slate-400"
                )
              }
            >
              <item.icon size={15} className="shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
        {/* Citizen Portal quick-link — always available to all staff */}
        <NavLink
          to="/citizen"
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-2 px-3 sm:px-3.5 py-2.5 text-[11px] sm:text-xs font-semibold uppercase tracking-wider transition-all border-b-2 border-transparent text-emerald-300 hover:text-emerald-100 hover:bg-[#102e54] hover:border-emerald-400 ml-2"
        >
          <ExternalLink size={13} className="shrink-0" />
          <span>Citizen Portal</span>
        </NavLink>
      </nav>

      {/* Mobile Drawer Dropdown Menu (when toggled via mobile menu button) */}
      {mobileOpen && (
        <div className="lg:hidden border-t border-[#123157] bg-[#0c284a] px-3 py-2 space-y-1 animate-fade-in">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={onNavigate}
              className={({ isActive }) =>
                clsx(
                  "flex items-center gap-2.5 px-3 py-2 rounded text-xs font-medium transition-colors",
                  isActive
                    ? "bg-[#143560] text-[#FFB055] font-semibold border-l-4 border-[#FF9933]"
                    : "text-slate-200 hover:bg-[#102e54] hover:text-white"
                )
              }
            >
              <item.icon size={15} className="shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          ))}
        </div>
      )}
    </div>
  );
}
