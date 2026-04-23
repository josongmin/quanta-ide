/** Small, timezone-neutral time formatters. */

const RELATIVE_DIVISIONS: Array<{
  amount: number;
  unit: Intl.RelativeTimeFormatUnit;
}> = [
  { amount: 60, unit: "seconds" },
  { amount: 60, unit: "minutes" },
  { amount: 24, unit: "hours" },
  { amount: 7, unit: "days" },
  { amount: 4.34524, unit: "weeks" },
  { amount: 12, unit: "months" },
  { amount: Number.POSITIVE_INFINITY, unit: "years" },
];

const REL = new Intl.RelativeTimeFormat("en", { numeric: "auto", style: "short" });

export function relativeTime(iso: string, now = Date.now()): string {
  const then = new Date(iso).getTime();
  let duration = (then - now) / 1000;
  for (const division of RELATIVE_DIVISIONS) {
    if (Math.abs(duration) < division.amount) {
      return REL.format(Math.round(duration), division.unit);
    }
    duration /= division.amount;
  }
  return REL.format(Math.round(duration), "years");
}

export function formatAbsolute(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export function minutesAgo(mins: number, base = Date.now()): string {
  return new Date(base - mins * 60_000).toISOString();
}
export function hoursAgo(hrs: number, base = Date.now()): string {
  return new Date(base - hrs * 3600_000).toISOString();
}
export function daysAgo(days: number, base = Date.now()): string {
  return new Date(base - days * 86_400_000).toISOString();
}
