import type { PolicySeverity, ViolationStatus } from "@quanta/domain-types/policies";

/** CSS class suffix for severity badges. */
export function severityClass(severity: PolicySeverity): string {
  return `pol-sev--${severity}`;
}

/** CSS class suffix for violation status badges. */
export function violationStatusClass(status: ViolationStatus): string {
  return `pol-vs--${status}`;
}

/** Relative time label: "2h ago", "3d ago", "just now". */
export function relativeTime(ts: number): string {
  const diff = Date.now() - ts;
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

/** Truncate long paths for display. */
export function shortPath(file: string, max = 40): string {
  if (file.length <= max) return file;
  return "..." + file.slice(file.length - max + 3);
}
