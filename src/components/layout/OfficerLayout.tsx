import { useState } from "react";
import { Outlet } from "react-router-dom";
import { X } from "lucide-react";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function OfficerLayout({ title, breadcrumb }: { title: string; breadcrumb?: string[] }) {
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="h-screen flex bg-gray-50">
      {/* Desktop sidebar */}
      <div className="hidden md:block shrink-0">
        <Sidebar collapsed={collapsed} onToggleCollapse={() => setCollapsed((c) => !c)} variant="officer" />
      </div>

      {/* Mobile drawer */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 md:hidden">
          <div className="absolute inset-0 bg-navy-950/60" onClick={() => setMobileOpen(false)} />
          <div className="absolute left-0 top-0 h-full animate-fade-in">
            <div className="relative h-full">
              <Sidebar collapsed={false} onNavigate={() => setMobileOpen(false)} variant="officer" />
              <button
                onClick={() => setMobileOpen(false)}
                className="absolute top-4 -right-10 text-white bg-navy-800 rounded-full p-1.5"
              >
                <X size={16} />
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex-1 flex flex-col min-w-0">
        <Header title={title} breadcrumb={breadcrumb} onMenuClick={() => setMobileOpen(true)} />
        <main className="flex-1 overflow-y-auto p-4 md:p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
