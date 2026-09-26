import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type UserRole = "officer" | "super_admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string;
  jurisdiction?: string;
  assignedState?: string;
  avatar?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  officer: AuthUser | null;
  isAuthenticated: boolean;
  loginOfficer: (identifier: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  loginSuperAdmin: (identifier: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const STORAGE_KEY = "mplads_session";
const TOKEN_KEY = "mplads_token";
const BACKEND_BASE_URL = (import.meta as any).env?.VITE_BACKEND_URL || ((import.meta as any).env?.DEV ? "http://localhost:8000" : window.location.origin);

const DISPLAY_NAMES: Record<string, string> = {
  "ADMIN-NEURAL-NOVA": "National Vigilance Administrator",
  "AUDITOR-VIGILANCE-01": "National Vigilance Auditor",
  "OFFICER-DELHI-01": "Delhi District Officer",
  "OFFICER-MH-01": "Pune District Officer",
  "OFFICER-JH-01": "Giridih District Officer",
  "STATE-MH-NODAL": "Maharashtra State Nodal Officer",
  "STATE-KA-NODAL": "Karnataka State Nodal Officer",
  "STATE-JH-NODAL": "Jharkhand State Nodal Officer",
  "MP-DHARWAD-01": "Dharwad Constituency Officer",
  "MP-GIRIDIH-01": "Giridih Constituency Officer",
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function loadStoredSession(): AuthUser | null {
  if (!localStorage.getItem(TOKEN_KEY)) return null;
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "null");
  } catch {
    return null;
  }
}

function errorDetail(payload: any): string {
  if (typeof payload?.detail === "string") return payload.detail;
  return "Authentication failed. Please verify the officer ID and password.";
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(loadStoredSession);

  const authenticate = useCallback(async (identifier: string, password: string | undefined, requestedRole: UserRole) => {
    try {
      const response = await fetch(`${BACKEND_BASE_URL}/auth/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ officer_id: identifier.trim().toUpperCase(), password: password || "" }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.access_token || !data.officer) {
        return { success: false, error: errorDetail(data) };
      }

      const profile = data.officer;
      const isAdmin = ["national_admin", "superadmin"].includes(String(profile.role).toLowerCase());
      if ((requestedRole === "super_admin") !== isAdmin) {
        return { success: false, error: isAdmin ? "Use the Super Admin sign-in tab for this account." : "This account does not have Super Admin access." };
      }

      const id = String(profile.officer_id);
      const state = String(profile.state || "");
      const district = String(profile.district || "");
      const assignedState = state && state !== "ALL" ? state : district && district !== "ALL" ? district : "";
      const authUser: AuthUser = {
        id,
        name: DISPLAY_NAMES[id] || id,
        email: `${id.toLowerCase()}@mplads.gov.in`,
        role: isAdmin ? "super_admin" : "officer",
        title: isAdmin ? "National Vigilance Administrator" : "MPLADS Monitoring Officer",
        jurisdiction: district === "ALL" ? (state === "ALL" ? "All India" : state) : `${district}, ${state}`,
        assignedState: assignedState ? assignedState.toLowerCase().replace(/\b\w/g, (m: string) => m.toUpperCase()) : undefined,
      };
      localStorage.setItem(TOKEN_KEY, data.access_token);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(authUser));
      setUser(authUser);
      return { success: true };
    } catch {
      return { success: false, error: "Authentication service is unavailable. Please retry when the backend is online." };
    }
  }, []);

  const loginOfficer = useCallback(
    (identifier: string, password?: string) => authenticate(identifier, password, "officer"),
    [authenticate],
  );
  const loginSuperAdmin = useCallback(
    (identifier: string, password?: string) => authenticate(identifier, password, "super_admin"),
    [authenticate],
  );

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem("mplads_officer_jwt_token");
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, officer: user, isAuthenticated: Boolean(user), loginOfficer, loginSuperAdmin, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
