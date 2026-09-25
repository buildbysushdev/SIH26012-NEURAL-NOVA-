import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth, type UserRole } from "../context/AuthContext";

export default function ProtectedRoute({
  children,
  allowedRoles,
}: {
  children: ReactNode;
  /** If omitted, any authenticated user is allowed. */
  allowedRoles?: UserRole[];
}) {
  const { isAuthenticated, user } = useAuth();
  if (!isAuthenticated) return <Navigate to="/login" replace />;
  if (allowedRoles && user && !allowedRoles.includes(user.role)) {
    // Signed in but with the wrong role — send them to their own portal.
    return <Navigate to={user.role === "super_admin" ? "/admin/dashboard" : "/dashboard"} replace />;
  }
  return <>{children}</>;
}
