import { useLocation } from "react-router-dom";

/**
 * Returns "/admin" when the current route is inside the Super Admin portal,
 * or "" when inside the Officer portal. Used to build portal-relative links
 * for shared components (Projects, Alerts, etc.) that are reused by both
 * the Officer Portal and the Super Admin Portal.
 */
export function usePortalBase(): string {
  const location = useLocation();
  return location.pathname.startsWith("/admin") ? "/admin" : "";
}
