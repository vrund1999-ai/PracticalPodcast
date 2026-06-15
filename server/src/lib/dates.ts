import { env } from "../config/env";

const TZ = env.APP_TZ;

/** YYYY-MM-DD for a Date, in the app timezone (en-CA formats as ISO date). */
export function appDateString(d: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(d);
}

/** Today's date string in the app timezone. */
export function appToday(): string {
  return appDateString(new Date());
}

function toUTCDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(Date.UTC(y, m - 1, d));
}

/** Whole-day difference: (a - b) in days, both YYYY-MM-DD. */
function dayDiff(a: string, b: string): number {
  return Math.round((toUTCDate(a).getTime() - toUTCDate(b).getTime()) / 86_400_000);
}

/** Shift a YYYY-MM-DD string by n days. */
export function addDays(dateStr: string, n: number): string {
  const dt = toUTCDate(dateStr);
  dt.setUTCDate(dt.getUTCDate() + n);
  return dt.toISOString().slice(0, 10);
}

/** "Today" | "Yesterday" | weekday name | full date — relative to today. */
export function dayLabel(dateStr: string, today = appToday()): string {
  const diff = dayDiff(today, dateStr);
  if (diff === 0) return "Today";
  if (diff === 1) return "Yesterday";
  const dt = toUTCDate(dateStr);
  if (diff > 1 && diff < 7) {
    return new Intl.DateTimeFormat("en-US", { weekday: "long", timeZone: "UTC" }).format(dt);
  }
  return dayDisplayDate(dateStr);
}

/** "Saturday, June 13, 2026" */
export function dayDisplayDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "long",
    month: "long",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(toUTCDate(dateStr));
}

/** "Jun 13" */
export function shortDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    timeZone: "UTC",
  }).format(toUTCDate(dateStr));
}

/** "Jun 13, 2026" */
export function mediumDate(dateStr: string): string {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
    timeZone: "UTC",
  }).format(toUTCDate(dateStr));
}

/** "5:12 AM" in the app timezone. */
export function timeLabel(d: Date): string {
  return new Intl.DateTimeFormat("en-US", {
    hour: "numeric",
    minute: "2-digit",
    timeZone: TZ,
  }).format(d);
}
