// Shared chip-bar primitives for CodeMirror block widgets.
// All builders return DOM nodes (no innerHTML) so user-facing fields
// like owner/email/filename can flow through safely.

import type { Taint } from "@quanta/app-ide/entities/symbol";
import { tone as riskTone } from "@quanta/app-ide/entities/risk";

export type ChipKind =
  | "default"
  | "bad"
  | "warn"
  | "muted"
  | "taint-source"
  | "taint-sink"
  | "taint-passthrough"
  | "taint-sanitized";

export interface ChipSpec {
  /** Optional uppercase 8px label (e.g. "blast", "cpx"). Omit for label-only chips. */
  ico?: string;
  value: string | number;
  /** small trailing label, e.g. "O(n)", "91%" */
  sub?: string;
  /** italic suffix, e.g. "·3 crit" */
  em?: string;
  kind?: ChipKind;
}

/** Re-export of the shared risk → tone helper. */
export const tone = riskTone;

/** Map a `Taint` value to the matching chip kind. Single source of truth. */
export function taintChipKind(t: Taint | undefined): ChipKind {
  switch (t) {
    case "source": return "taint-source";
    case "sink": return "taint-sink";
    case "passthrough": return "taint-passthrough";
    case "sanitized": return "taint-sanitized";
    default: return "default";
  }
}

/**
 * ChipKind → trailing class-name fragment.
 * Single source of truth: TS exhaustiveness on `Record<ChipKind, …>`
 * catches any missing key at compile time. Each value is either ""
 * (no extra class) or a leading-space-prefixed class string ready to
 * be concatenated onto the base `cm-chip` token.
 */
const CHIP_KIND_CLASS: Record<ChipKind, string> = {
  default: "",
  bad: " is-bad",
  warn: " is-warn",
  muted: " is-muted",
  "taint-source": " cm-chip--taint-source",
  "taint-sink": " cm-chip--taint-sink",
  "taint-passthrough": " cm-chip--taint-passthrough",
  "taint-sanitized": " cm-chip--taint-sanitized",
};

export function createChip(spec: ChipSpec): HTMLElement {
  const span = document.createElement("span");
  span.className = "cm-chip" + CHIP_KIND_CLASS[spec.kind ?? "default"];

  if (spec.ico) {
    const ico = document.createElement("span");
    ico.className = "cm-chip__ico";
    ico.textContent = spec.ico;
    span.appendChild(ico);
  }

  span.appendChild(document.createTextNode(String(spec.value)));

  if (spec.em) {
    const em = document.createElement("em");
    em.textContent = `·${spec.em}`;
    span.appendChild(em);
  }
  if (spec.sub) {
    const sub = document.createElement("span");
    sub.className = "cm-chip__sub";
    sub.textContent = ` ${spec.sub}`;
    span.appendChild(sub);
  }

  // a11y: build a flat label by concatenating ico, value, em, sub.
  // Skip nullish parts; `value` always coerces. The chip itself stays
  // presentational (no role) — the bar container owns role="group".
  const parts = [spec.ico, String(spec.value), spec.em, spec.sub].filter(Boolean);
  span.setAttribute("aria-label", parts.join(" ").trim());

  return span;
}

export function createMeta(text: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "cm-chip-bar__meta";
  span.textContent = text;
  span.setAttribute("aria-label", text);
  return span;
}

/**
 * Risk score pill.
 * - `createRisk(78)` — bare pill (file-header use).
 * - `createRisk(78, "risk")` — pill prefixed with an ico span carrying
 *   the given label as text (fn-header use). Pass any short label, not
 *   a boolean — the caller decides what reads inside the badge.
 */
export function createRisk(score: number, icoLabel?: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "cm-chip-bar__risk";
  if (icoLabel) {
    const ico = document.createElement("span");
    ico.className = "cm-chip__ico";
    ico.textContent = icoLabel;
    span.appendChild(ico);
  }
  span.appendChild(document.createTextNode(String(score)));
  span.setAttribute("aria-label", `risk score ${score}`);
  return span;
}

/**
 * Stable signature for `WidgetType.eq()` — every value that flows into
 * the rendered DOM must be included so a content change forces re-render.
 * Use `\u001f` (Unit Separator) so user-supplied strings can't collide.
 * Cache the result in the widget's constructor — `eq()` is hot.
 */
export function signature(...parts: (string | number | boolean | null | undefined)[]): string {
  return parts.map((p) => (p == null ? "" : String(p))).join("\u001f");
}
