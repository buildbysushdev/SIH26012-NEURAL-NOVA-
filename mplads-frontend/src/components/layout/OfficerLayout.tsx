import { useState } from "react";
import { Outlet } from "react-router-dom";
import Sidebar from "./Sidebar";
import Header from "./Header";

export default function OfficerLayout({ title, breadcrumb }: { title: string; breadcrumb?: string[] }) {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen flex flex-col bg-[#f4f6f9] text-gray-900 transition-colors">
      <Header title={title} breadcrumb={breadcrumb} onMenuClick={() => setMobileOpen((v) => !v)} />
      <Sidebar variant="officer" mobileOpen={mobileOpen} onNavigate={() => setMobileOpen(false)} />
      <main className="flex-1 overflow-y-auto p-3 sm:p-5 md:p-6 max-w-7xl w-full mx-auto">
        <Outlet />
      </main>
    </div>
  );
}
