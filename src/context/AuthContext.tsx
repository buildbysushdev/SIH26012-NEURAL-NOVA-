import { createContext, useContext, useState, useCallback, type ReactNode } from "react";

export type UserRole = "officer" | "super_admin";

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title: string; // display role/title, e.g. "District Monitoring Officer"
  jurisdiction?: string;
  assignedState?: string;
  avatar?: string;
}

interface AuthContextValue {
  user: AuthUser | null;
  /** @deprecated kept for backward compatibility with components expecting `officer` */
  officer: AuthUser | null;
  isAuthenticated: boolean;
  loginOfficer: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
  loginSuperAdmin: (email: string, password?: string) => Promise<{ success: boolean; error?: string }>;
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
      id: "OFFICER-DELHI-01",
      name: "R. Kulkarni, DISHA",
      email: "officer1@mplads.ai",
      role: "officer",
      title: "District Vigilance Officer",
      jurisdiction: "Delhi & Maharashtra",
      assignedState: "Maharashtra",
      avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
    },
  },
  "officer2@mplads.ai": {
    password: "officer123",
    user: {
      id: "OFFICER-KAR-02",
      name: "A. Deshmukh, DISHA",
      email: "officer2@mplads.ai",
      role: "officer",
      title: "District Monitoring Officer",
      jurisdiction: "Bengaluru, Karnataka",
      assignedState: "Karnataka",
      avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
    },
  },
  "officer3@mplads.ai": {
    password: "officer123",
    user: {
      id: "OFF-003",
      name: "K. Iyer, DISHA",
      email: "officer3@mplads.ai",
      role: "officer",
      title: "State Nodal Officer",
      jurisdiction: "Lucknow, Uttar Pradesh",
      assignedState: "Uttar Pradesh",
      avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80",
    },
  },
  "officer4@mplads.ai": {
    password: "officer123",
    user: {
      id: "OFF-004",
      name: "S. Verma, DISHA",
      email: "officer4@mplads.ai",
      role: "officer",
      title: "District Monitoring Officer",
      jurisdiction: "Jaipur, Rajasthan",
      assignedState: "Rajasthan",
      avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
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
      assignedState: "Maharashtra",
    },
  },
};

const SUPER_ADMIN_ACCOUNTS: Record<string, { password: string; user: AuthUser }> = {
  "admin@mplads.ai": {
    password: "admin123",
    user: {
      id: "ADMIN-VIGIL-01",
      name: "P. Sharma, IAS",
      email: "admin@mplads.ai",
      role: "super_admin",
      title: "Central Vigilance Super Administrator",
      jurisdiction: "All India",
      avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&auto=format&fit=crop&q=80",
    },
  },
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (parsed && parsed.role === "officer" && !parsed.assignedState) {
          const match = OFFICER_ACCOUNTS[parsed.email?.toLowerCase()]?.user;
          parsed.assignedState = match?.assignedState || "Maharashtra";
          localStorage.setItem(STORAGE_KEY, JSON.stringify(parsed));
        }
        return parsed;
      } catch {
        return null;
      }
    }
    return null;
  });

  const loginOfficer = useCallback(async (identifier: string, password?: string) => {
    await new Promise((r) => setTimeout(r, 400));
    const cleanId = identifier.trim().toLowerCase();
    
    // Direct match or alias match
    let record = OFFICER_ACCOUNTS[cleanId];
    if (!record) {
      if (cleanId.includes("delhi") || cleanId === "off-001" || cleanId === "officer1" || cleanId === "officer-delhi-01") {
        record = OFFICER_ACCOUNTS["officer1@mplads.ai"];
      } else if (cleanId.includes("karnataka") || cleanId === "off-002" || cleanId === "officer2" || cleanId.includes("kar")) {
        record = OFFICER_ACCOUNTS["officer2@mplads.ai"];
      } else if (cleanId.includes("up") || cleanId === "off-003" || cleanId === "officer3") {
        record = OFFICER_ACCOUNTS["officer3@mplads.ai"];
      } else if (cleanId.includes("rajasthan") || cleanId === "off-004" || cleanId === "officer4") {
        record = OFFICER_ACCOUNTS["officer4@mplads.ai"];
      } else {
        const found = Object.values(OFFICER_ACCOUNTS).find(
          (acc) => acc.user.id.toLowerCase() === cleanId || acc.user.email.toLowerCase() === cleanId
        );
        if (found) record = found;
      }
    }

    if (record) {
      if (!password || password === record.password || password === "officer123" || password === "demo123" || password.length >= 4) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(record.user));
        setUser(record.user);
        return { success: true };
      }
    }
    return { success: false, error: "Invalid Officer ID / Password. Please check credentials or select a demo account." };
  }, []);

  const loginSuperAdmin = useCallback(async (identifier: string, password?: string) => {
    await new Promise((r) => setTimeout(r, 400));
    const cleanId = identifier.trim().toLowerCase();
    
    let record = SUPER_ADMIN_ACCOUNTS[cleanId];
    if (!record) {
      if (cleanId === "admin" || cleanId === "adm-001" || cleanId === "admin-vigil-01" || cleanId.includes("admin")) {
        record = SUPER_ADMIN_ACCOUNTS["admin@mplads.ai"];
      }
    }

    if (record) {
      if (!password || password === record.password || password === "admin123" || password.length >= 4) {
        localStorage.setItem(STORAGE_KEY, JSON.stringify(record.user));
        setUser(record.user);
        return { success: true };
      }
    }
    return { success: false, error: "Invalid Super Admin ID / Password. Please check credentials." };
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
