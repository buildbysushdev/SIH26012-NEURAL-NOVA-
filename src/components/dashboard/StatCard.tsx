import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, ArrowDownRight } from "lucide-react";
import clsx from "clsx";
import Card from "../ui/Card";

export default function StatCard({
  label,
  value,
  trend,
  trendGoodDirection = "up",
  icon: Icon,
  tone = "navy",
  onClick,
}: {
  label: string;
  value: string;
  trend?: number;
  trendGoodDirection?: "up" | "down";
  icon: LucideIcon;
  tone?: "navy" | "red" | "amber" | "green";
  onClick?: () => void;
}) {
  const toneStyles: Record<string, string> = {
    navy: "bg-navy-50 text-navy-700",
    red: "bg-red-50 text-red-600",
    amber: "bg-amber-50 text-amber-600",
    green: "bg-emerald-50 text-emerald-600",
  };

  const isGood = trend !== undefined && (trendGoodDirection === "up" ? trend >= 0 : trend <= 0);

  return (
    <Card
      onClick={onClick}
      className={clsx(
        "transition-all duration-150",
        onClick && "cursor-pointer hover:shadow-md hover:-translate-y-0.5"
      )}
    >
      <div className="flex items-start justify-between">
        <div className={clsx("w-10 h-10 rounded-lg flex items-center justify-center", toneStyles[tone])}>
          <Icon size={19} />
        </div>
        {trend !== undefined && (
          <span
            className={clsx(
              "flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded-md",
              isGood ? "text-emerald-700 bg-emerald-50" : "text-red-700 bg-red-50"
            )}
          >
            {trend >= 0 ? <ArrowUpRight size={12} /> : <ArrowDownRight size={12} />}
            {Math.abs(trend)}%
          </span>
        )}
      </div>
      <p className="text-2xl font-bold text-gray-900 mt-3">{value}</p>
      <p className="text-sm text-gray-500 mt-0.5">{label}</p>
    </Card>
  );
}
