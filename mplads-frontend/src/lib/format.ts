export function formatINR(amount: number): string {
  if (amount >= 10000000) return `₹${(amount / 10000000).toFixed(2)} Cr`;
  if (amount >= 100000) return `₹${(amount / 100000).toFixed(1)} L`;
  return `₹${amount.toLocaleString("en-IN")}`;
}

export function formatDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

export function riskLevelColor(level: string): string {
  switch (level) {
    case "Low":
      return "#16a34a";
    case "Medium":
      return "#d97706";
    case "High":
      return "#ea580c";
    case "Critical":
      return "#dc2626";
    default:
      return "#6b7280";
  }
}
