// Shared chip-bar primitives for CodeMirror block widgets.
// All builders return DOM nodes (no innerHTML) so user-facing fields
// like owner/email/filename can flow through safely.

import type { Taint } from "@quanta/app-ide/entities/symbol";
import { tone as riskTone } from "@quanta/app-ide/entities/risk";
import type { RiskTone } from "@quanta/app-ide/entities/risk";

/** @deprecated re-exported for back-compat — prefer `RiskTone` from `entities/risk`. */
export type ChipTone = RiskTone;

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

export function createChip(spec: ChipSpec): HTMLElement {
  const span = document.createElement("span");
  span.className = "cm-fnhead__chip" + chipKindSuffix(spec.kind ?? "default");

  if (spec.ico) {
    const ico = document.createElement("span");
    ico.className = "cm-fnhead__ico";
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
    sub.className = "cm-fnhead__sub";
    sub.textContent = ` ${spec.sub}`;
    span.appendChild(sub);
  }
  return span;
}

export function createMeta(text: string): HTMLElement {
  const span = document.createElement("span");
  span.className = "cm-fnhead__meta";
  span.textContent = text;
  return span;
}

export function createRisk(score: number, opts?: { ico?: boolean }): HTMLElement {
  const span = document.createElement("span");
  span.className = "cm-fnhead__risk";
  if (opts?.ico) {
    const ico = document.createElement("span");
    ico.className = "cm-fnhead__ico";
    ico.textContent = "risk";
    span.appendChild(ico);
  }
  span.appendChild(document.createTextNode(String(score)));
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

function chipKindSuffix(kind: ChipKind): string {
  switch (kind) {
    case "bad":
      return " is-bad";
    case "warn":
      return " is-warn";
    case "muted":
      return " is-muted";
    case "taint-source":
      return " cm-fnhead__chip--taint-source";
    case "taint-sink":
      return " cm-fnhead__chip--taint-sink";
    case "taint-passthrough":
      return " cm-fnhead__chip--taint-passthrough";
    case "taint-sanitized":
      return " cm-fnhead__chip--taint-sanitized";
    default:
      return "";
  }
}
