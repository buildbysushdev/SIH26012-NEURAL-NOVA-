/**
 * GovPageHeader — Official Government Portal Section Header
 *
 * Reusable page-level header for all in-app dashboard pages.
 * Matches the MoSPI / GOI portal identity (login page design).
 * Shows: Ashoka Emblem (miniaturized), Ministry name strip, Indian Flag,
 * page title, subtitle, and optional right-side action/badge slot.
 */
import type { ReactNode } from "react";
import { AshokaEmblem, IndianFlag } from "../layout/Header";

interface GovPageHeaderProps {
  /** Main page heading (English) */
  title: string;
  /** Hindi subtitle / bilingual label */
  subtitle?: string;
  /** Optional short description line */
  description?: string;
  /** Content to render on the right side (filter widgets, status badges, etc.) */
  rightContent?: ReactNode;
  /** Extra badge text shown left of the title (e.g. "DISTRICT SCOPED") */
  scopeBadge?: string;
  /** Whether to show the emblem + flag strip — default true */
  showIdentity?: boolean;
  /** Optional override for top live indicator dot color: 'green' | 'amber' | 'red' */
  statusDot?: "green" | "amber" | "red" | "none";
}

const DOT_COLORS = {
  green: "bg-emerald-500 animate-pulse",
  amber: "bg-amber-500 animate-pulse",
  red: "bg-red-500 animate-pulse",
  none: "hidden",
};

export default function GovPageHeader({
  title,
  subtitle,
  description,
  rightContent,
  scopeBadge,
  showIdentity = true,
  statusDot = "green",
}: GovPageHeaderProps) {
  return (
    <div className="bg-white border border-gray-200 rounded-md shadow-sm overflow-hidden">
      {/* Top accent band — Official GOI tricolor stripe */}
      <div className="flex h-0.5">
        <div className="w-1/3 bg-[#FF9933]" />
        <div className="w-1/3 bg-white border-t border-b border-gray-200" />
        <div className="w-1/3 bg-[#138808]" />
      </div>

      <div className="px-4 sm:px-5 py-3.5 sm:py-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        {/* Left: Identity emblem + title block */}
        <div className="flex items-start gap-3">
          {showIdentity && (
            <div className="flex items-center gap-1.5 shrink-0 pt-0.5">
              <AshokaEmblem className="w-7 h-8 sm:w-8 sm:h-10 text-[#0b2545]" />
              {/* Mini tricolor stripe */}
              <div className="flex flex-col w-0.5 h-7 sm:h-9 overflow-hidden shrink-0">
                <div className="flex-1 bg-[#FF9933]" />
                <div className="flex-1 bg-white border-y border-gray-300" />
                <div className="flex-1 bg-[#138808]" />
              </div>
            </div>
          )}

          <div className="min-w-0">
            {/* Section tag */}
            <div className="flex items-center gap-2 mb-0.5">
              {statusDot !== "none" && (
                <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${DOT_COLORS[statusDot]}`} />
              )}
              {scopeBadge && (
                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-[#eef2f7] text-[#0b2545] border border-[#c5d3e0] tracking-wider uppercase">
                  {scopeBadge}
                </span>
              )}
            </div>

            <h1 className="text-base sm:text-lg font-bold text-[#0b2545] leading-tight tracking-tight">
              {title}
            </h1>
            {subtitle && (
              <p className="text-xs font-semibold text-gray-500 mt-0.5">{subtitle}</p>
            )}
            {description && (
              <p className="text-[11px] sm:text-xs text-gray-500 mt-1 max-w-xl">{description}</p>
            )}
          </div>
        </div>

        {/* Right: action slot + Indian Flag */}
        <div className="flex items-center gap-3 shrink-0 flex-wrap">
          {rightContent}
          {/* Indian National Flag — always shown */}
          <div className="rounded border border-gray-200 shadow-xs overflow-hidden shrink-0">
            <IndianFlag className="w-9 h-6 sm:w-10 sm:h-7" />
          </div>
        </div>
      </div>

      {/* Bottom accent band */}
      <div className="flex h-0.5">
        <div className="w-1/3 bg-[#FF9933]" />
        <div className="w-1/3 bg-white border-t border-b border-gray-200" />
        <div className="w-1/3 bg-[#138808]" />
      </div>
    </div>
  );
}
