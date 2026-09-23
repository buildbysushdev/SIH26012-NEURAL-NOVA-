import { useState } from "react";
import { Link, Outlet, useLocation } from "react-router-dom";
import { ShieldCheck, Menu, X } from "lucide-react";
import clsx from "clsx";

const NAV = [
  { to: "/citizen", label: "Home" },
  { to: "/citizen?section=search", label: "Search Projects" },
  { to: "/citizen/report", label: "Report an Issue" },
  { to: "/citizen?section=about", label: "About MPLADS" },
];

export default function CitizenLayout() {
  const [open, setOpen] = useState(false);
  const location = useLocation();

  return (
    <div className="min-h-screen bg-white flex flex-col">
      <header className="sticky top-0 z-30 bg-white border-b border-gray-200">
        <div className="max-w-6xl mx-auto px-4 h-16 flex items-center justify-between">
          <Link to="/citizen" className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-lg bg-navy-800 flex items-center justify-center">
              <ShieldCheck size={18} className="text-white" />
            </div>
            <div>
              <p className="font-bold text-gray-900 leading-tight text-sm">MPLADS</p>
              <p className="text-[11px] text-gray-500">Public Project Information</p>
            </div>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {NAV.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                className="text-sm font-medium text-gray-600 hover:text-navy-800 transition-colors"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/login"
              className="text-sm font-medium bg-navy-800 text-white px-4 py-2 rounded-lg hover:bg-navy-700"
            >
              Officer Login
            </Link>
          </nav>

          <button className="md:hidden text-gray-600" onClick={() => setOpen((o) => !o)}>
            {open ? <X size={22} /> : <Menu size={22} />}
          </button>
        </div>
        {open && (
          <div className="md:hidden border-t border-gray-100 px-4 py-3 space-y-1">
            {NAV.map((item) => (
              <Link
                key={item.label}
                to={item.to}
                onClick={() => setOpen(false)}
                className="block py-2 text-sm font-medium text-gray-700"
              >
                {item.label}
              </Link>
            ))}
            <Link
              to="/login"
              onClick={() => setOpen(false)}
              className="block py-2 text-sm font-medium text-navy-800"
            >
              Officer Login
            </Link>
          </div>
        )}
      </header>

      <main className="flex-1">
        <Outlet key={location.key} />
      </main>

      <footer className="bg-navy-900 text-navy-300 text-sm mt-10">
        <div className="max-w-6xl mx-auto px-4 py-8 flex flex-col md:flex-row justify-between gap-4">
          <div>
            <p className="text-white font-semibold">MPLADS AI Monitoring Platform</p>
            <p className="text-xs mt-1 max-w-md">
              An AI-assisted decision-support system for MPLADS transparency. Flags are indicative risk
              signals for review, not confirmed findings.
            </p>
          </div>
          <div className={clsx("text-xs")}>
            © {new Date().getFullYear()} MPLADS AI · Built for Smart India Hackathon 2026 · PS 26102
          </div>
        </div>
      </footer>
    </div>
  );
}
