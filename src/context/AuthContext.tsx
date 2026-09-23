import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type UserRole = "officer" | "super_admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string; // display role/title, e.g. "District Monitoring Officer"
  jurisdiction?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** @deprecated kept for backward compatibility with components expecting `officer` */
  officer: AuthUser | null;
  isAuthenticated: boolean;
  loginOfficer: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  loginSuperAdmin: (email: string, password: string) => Promise<{ success: boolean; error?: string }>;
  logout: () => void;
}

const STORAGE_KEY = "mplads_session";

// ---------------------------------------------------------------------------
// Demo accounts (frontend-only mock authentication)
// ---------------------------------------------------------------------------
const OFFICER_ACCOUNTS: Record<string, { password: string; user: AuthUser }> = {
  "officer1@mplads.ai": {
    password: "officer123",
    user: {
      id: "OFF-001",
      name: "R. Kulkarni",
      email: "officer1@mplads.ai",
      role: "officer",
      title: "District Monitoring Officer",
      jurisdiction: "Pune, Maharashtra",
    },
  },
  "officer2@mplads.ai": {
    password: "officer123",
    user: {
      id: "OFF-002",
      name: "A. Deshmukh",
      email: "officer2@mplads.ai",
      role: "officer",
      title: "District Monitoring Officer",
      jurisdiction: "Nashik, Maharashtra",
    },
  },
  "officer3@mplads.ai": {
    password: "officer123",
    user: {
      id: "OFF-003",
      name: "K. Iyer",
      email: "officer3@mplads.ai",
      role: "officer",
      title: "State Nodal Officer",
      jurisdiction: "Karnataka",
    },
  },
  "officer4@mplads.ai": {
    password: "officer123",
    user: {
      id: "OFF-004",
      name: "S. Verma",
      email: "officer4@mplads.ai",
      role: "officer",
      title: "District Monitoring Officer",
      jurisdiction: "Lucknow, Uttar Pradesh",
    },
  },
  // Backward-compatible original demo account
  "demo@mplads.ai": {
    password: "demo123",
    user: {
      id: "OFF-000",
      name: "Officer R. Kulkarni",
      email: "demo@mplads.ai",
      role: "officer",
      title: "District Monitoring Officer",
      jurisdiction: "Maharashtra",
    },
  },
};

const SUPER_ADMIN_ACCOUNTS: Record<string, { password: string; user: AuthUser }> = {
  "admin@mplads.ai": {
    password: "admin123",
    user: {
      id: "ADM-001",
      name: "P. Sharma",
      email: "admin@mplads.ai",
      role: "super_admin",
      title: "Super Administrator",
      jurisdiction: "All India",
    },
  },
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    return stored ? JSON.parse(stored) : null;
  });

  const loginOfficer = useCallback(async (email: string, password: string) => {
    await new Promise((r) => setTimeout(r, 700));
    const record = OFFICER_ACCOUNTS[email.trim().toLowerCase()];
    if (record && record.password === password) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record.user));
      setUser(record.user);
      return { success: true };
    }
    return { success: false, error: "Invalid Officer ID or password. Use one of the demo credentials shown below." };
  }, []);

  const loginSuperAdmin = useCallback(async (email: string, password: string) => {
    await new Promise((r) => setTimeout(r, 700));
    const record = SUPER_ADMIN_ACCOUNTS[email.trim().toLowerCase()];
    if (record && record.password === password) {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(record.user));
      setUser(record.user);
      return { success: true };
    }
    return { success: false, error: "Invalid Super Admin ID or password. Use the demo credentials shown below." };
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(STORAGE_KEY);
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider
      value={{ user, officer: user, isAuthenticated: !!user, loginOfficer, loginSuperAdmin, logout }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}
