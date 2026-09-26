import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { AuthProvider } from "./context/AuthContext";
import { ToastProvider } from "./context/ToastContext";
import ProtectedRoute from "./router/ProtectedRoute";

import OfficerLayout from "./components/layout/OfficerLayout";
import AdminLayout from "./components/layout/AdminLayout";

import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import Projects from "./pages/Projects";
import ProjectDetail from "./pages/ProjectDetail";
import Alerts from "./pages/Alerts";
import { useEffect } from "react";
import RiskMap from "./pages/RiskMap";
import Analytics from "./pages/Analytics";
import Reports from "./pages/Reports";
import Settings from "./pages/Settings";
import MyWorkspace from "./pages/MyWorkspace";

import SuperAdminDashboard from "./pages/admin/SuperAdminDashboard";
import Officers from "./pages/admin/Officers";
import AuditLogs from "./pages/admin/AuditLogs";
import AdminCitizenReports from "./pages/admin/AdminCitizenReports";

function ProtectedOfficerLayout(props: { title: string; breadcrumb?: string[] }) {
  return (
    <ProtectedRoute allowedRoles={["officer"]}>
      <OfficerLayout {...props} />
    </ProtectedRoute>
  );
}

function ProtectedAdminLayout(props: { title: string; breadcrumb?: string[] }) {
  return (
    <ProtectedRoute allowedRoles={["super_admin"]}>
      <AdminLayout {...props} />
    </ProtectedRoute>
  );
}

function CitizenPortalRedirect() {
  useEffect(() => {
    window.location.replace("/portal/");
  }, []);
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-[#002147] text-white p-4">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-amber-400 mb-3" />
      <p className="text-sm font-semibold">Redirecting to Official MPLADS Citizen Portal with Voice & Speech Recognition...</p>
    </div>
  );
}

export default function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem("mplads_theme");
    if (savedTheme === "Dark") {
      document.documentElement.classList.add("dark");
    } else {
      document.documentElement.classList.remove("dark");
      if (!savedTheme) {
        localStorage.setItem("mplads_theme", "Light");
      }
    }
  }, []);

  return (
    <AuthProvider>
      <ToastProvider>
        <BrowserRouter basename={window.location.pathname === "/app" || window.location.pathname.startsWith("/app/") ? "/app" : undefined}>
          <Routes>
            <Route path="/" element={<Navigate to="/login" replace />} />
            <Route path="/login" element={<Login />} />

            {/* ============================= Officer Portal ============================= */}
            <Route element={<ProtectedOfficerLayout title="Dashboard" />}>
              <Route path="/dashboard" element={<Dashboard />} />
            </Route>
            <Route element={<ProtectedOfficerLayout title="Projects" />}>
              <Route path="/projects" element={<Projects />} />
            </Route>
            <Route element={<ProtectedOfficerLayout title="Project Details" breadcrumb={["Projects"]} />}>
              <Route path="/projects/:id" element={<ProjectDetail />} />
              <Route path="/project/:id" element={<ProjectDetail />} />
              <Route path="/projects/*" element={<ProjectDetail />} />
              <Route path="/project/*" element={<ProjectDetail />} />
            </Route>
            <Route element={<ProtectedOfficerLayout title="Risk & Alerts" />}>
              <Route path="/alerts" element={<Alerts />} />
            </Route>
            <Route element={<ProtectedOfficerLayout title="State Risk Map" />}>
              <Route path="/risk-map" element={<RiskMap />} />
            </Route>
            <Route element={<ProtectedOfficerLayout title="Analytics" />}>
              <Route path="/analytics" element={<Analytics />} />
            </Route>
            <Route element={<ProtectedOfficerLayout title="Reports" />}>
              <Route path="/reports" element={<Reports />} />
            </Route>
            <Route element={<ProtectedOfficerLayout title="My Workspace" />}>
              <Route path="/workspace" element={<MyWorkspace />} />
            </Route>
            <Route element={<ProtectedOfficerLayout title="Settings" />}>
              <Route path="/settings" element={<Settings />} />
            </Route>

            {/* ============================= Super Admin Portal ============================= */}
            <Route element={<ProtectedAdminLayout title="System Overview" />}>
              <Route path="/admin/dashboard" element={<SuperAdminDashboard />} />
            </Route>
            <Route element={<ProtectedAdminLayout title="Officers" />}>
              <Route path="/admin/officers" element={<Officers />} />
            </Route>
            <Route element={<ProtectedAdminLayout title="Projects" />}>
              <Route path="/admin/projects" element={<Projects />} />
            </Route>
            <Route element={<ProtectedAdminLayout title="Project Details" breadcrumb={["Projects"]} />}>
              <Route path="/admin/projects/:id" element={<ProjectDetail />} />
              <Route path="/admin/project/:id" element={<ProjectDetail />} />
              <Route path="/admin/projects/*" element={<ProjectDetail />} />
              <Route path="/admin/project/*" element={<ProjectDetail />} />
            </Route>
            <Route element={<ProtectedAdminLayout title="Risk & Alerts" />}>
              <Route path="/admin/alerts" element={<Alerts />} />
            </Route>
            <Route element={<ProtectedAdminLayout title="India Risk Map" />}>
              <Route path="/admin/risk-map" element={<RiskMap />} />
            </Route>
            <Route element={<ProtectedAdminLayout title="Citizen Reports" />}>
              <Route path="/admin/citizen-reports" element={<AdminCitizenReports />} />
            </Route>
            <Route element={<ProtectedAdminLayout title="Analytics" />}>
              <Route path="/admin/analytics" element={<Analytics />} />
            </Route>
            <Route element={<ProtectedAdminLayout title="Reports" />}>
              <Route path="/admin/reports" element={<Reports />} />
            </Route>
            <Route element={<ProtectedAdminLayout title="Audit Logs" />}>
              <Route path="/admin/audit-logs" element={<AuditLogs />} />
            </Route>
            <Route element={<ProtectedAdminLayout title="My Workspace" />}>
              <Route path="/admin/workspace" element={<MyWorkspace />} />
            </Route>
            <Route element={<ProtectedAdminLayout title="Settings" />}>
              <Route path="/admin/settings" element={<Settings />} />
            </Route>

            {/* ============================= Citizen Portal (public, speech-enabled) ============================= */}
            <Route path="/citizen" element={<CitizenPortalRedirect />} />
            <Route path="/citizen/*" element={<CitizenPortalRedirect />} />

            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
      </ToastProvider>
    </AuthProvider>
  );
}
