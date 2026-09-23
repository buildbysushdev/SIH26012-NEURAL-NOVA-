import type { ReactNode } from "react";
import clsx from "clsx";

export function RiskBadge({ level, size = "md" }: { level: string; size?: "sm" | "md" }) {
  const styles: Record<string, string> = {
    Low: "bg-risk-lowBg text-risk-low ring-1 ring-inset ring-green-200",
    Medium: "bg-risk-mediumBg text-risk-medium ring-1 ring-inset ring-amber-200",
    High: "bg-risk-highBg text-risk-high ring-1 ring-inset ring-orange-200",
    Critical: "bg-risk-criticalBg text-risk-critical ring-1 ring-inset ring-red-200",
    Review: "bg-gray-100 text-gray-600 ring-1 ring-inset ring-gray-200",
  };
  return (
    <span
      className={clsx(
        "inline-flex items-center font-semibold rounded-full",
        size === "sm" ? "text-[11px] px-2 py-0.5" : "text-xs px-2.5 py-1",
        styles[level] ?? styles.Review
      )}
    >
      {level}
    </span>
  );
}

export function StatusBadge({ status }: { status: string }) {
  const styles: Record<string, string> = {
    "Not Started": "bg-gray-100 text-gray-600",
    "In Progress": "bg-blue-50 text-blue-700",
    Completed: "bg-emerald-50 text-emerald-700",
    Delayed: "bg-orange-50 text-orange-700",
    Open: "bg-red-50 text-red-700",
    "Under Review": "bg-amber-50 text-amber-700",
    Assigned: "bg-blue-50 text-blue-700",
    Resolved: "bg-emerald-50 text-emerald-700",
    Received: "bg-blue-50 text-blue-700",
  };
  return (
    <span className={clsx("inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full", styles[status] ?? "bg-gray-100 text-gray-600")}>
      {status}
    </span>
  );
}

export function Badge({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "navy" }) {
  return (
    <span
      className={clsx(
        "inline-flex items-center text-xs font-medium px-2.5 py-1 rounded-full",
        tone === "navy" ? "bg-navy-50 text-navy-700" : "bg-gray-100 text-gray-600"
      )}
    >
      {children}
    </span>
  );
}
