/**
 * Computes live Indian Standard Time (IST = UTC+5:30)
 * Format strictly: "Fri, 25 Sept, 2026 | 03:50:13 pm IST"
 */
export function formatIST(): string {
  const now = new Date();
  const utc = now.getTime() + now.getTimezoneOffset() * 60000;
  const ist = new Date(utc + 5.5 * 3600000);

  const days = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sept",
    "Oct",
    "Nov",
    "Dec",
  ];

  const dayName = days[ist.getDay()];
  const dayNum = String(ist.getDate()).padStart(2, "0");
  const monthName = months[ist.getMonth()];
  const year = ist.getFullYear();

  let hours = ist.getHours();
  const minutes = String(ist.getMinutes()).padStart(2, "0");
  const seconds = String(ist.getSeconds()).padStart(2, "0");
  const ampm = hours >= 12 ? "pm" : "am";
  hours = hours % 12;
  hours = hours ? hours : 12;
  const hoursStr = String(hours).padStart(2, "0");

  return `${dayName}, ${dayNum} ${monthName}, ${year} | ${hoursStr}:${minutes}:${seconds} ${ampm} IST`;
}
