import type { PolicySeverity, ViolationStatus } from "@quanta/domain-types/policies";

// ── Query parser (used by QueryBar UI for chip rendering) ────────

export interface ParsedQuery {
  text: string;
  filters: QueryFilter[];
}

export interface QueryFilter {
  field: string;
  value: string;
  raw: string;
}

const FIELD_ALIASES: Record<string, string> = {
  e: "engine", eng: "engine",
  sev: "severity",
  s: "status",
  cat: "category",
  t: "tag",
  o: "owner",
};

/** Parse `engine:codeql severity:high free text` into structured filters + remainder. */
export function parseQuery(input: string): ParsedQuery {
  const filters: QueryFilter[] = [];
  const textParts: string[] = [];

  for (const part of input.split(/\s+/)) {
    const m = part.match(/^(\w+):(.+)$/);
    if (m) {
      const rawField = m[1].toLowerCase();
      filters.push({ field: FIELD_ALIASES[rawField] ?? rawField, value: m[2], raw: part });
    } else if (part) {
      textParts.push(part);
    }
  }

  return { text: textParts.join(" "), filters };
}

// ── CSS helpers ──────────────────────────────────────────────────

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
