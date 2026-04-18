// Shared chip-bar primitives for CodeMirror block widgets.
// All builders return DOM nodes (no innerHTML) so user-facing fields
// like owner/email/filename can flow through safely.

export type ChipTone = "low" | "mid" | "high";

export type ChipKind =
  | "default"
  | "bad"
  | "warn"
  | "muted"
  | "taint-source"
  | "taint-sink"
  | "taint-passthrough";

export interface ChipSpec {
  ico: string;
  value: string | number;
  /** small trailing label, e.g. "O(n)", "91%" */
  sub?: string;
  /** italic suffix, e.g. "·3 crit" */
  em?: string;
  kind?: ChipKind;
}

export function tone(riskScore: number): ChipTone {
  if (riskScore >= 70) return "high";
  if (riskScore >= 40) return "mid";
  return "low";
}

export function createChip(spec: ChipSpec): HTMLElement {
  const span = document.createElement("span");
  span.className = "cm-fnhead__chip" + chipKindSuffix(spec.kind ?? "default");

  const ico = document.createElement("span");
  ico.className = "cm-fnhead__ico";
  ico.textContent = spec.ico;
  span.appendChild(ico);

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

export function createRisk(score: number): HTMLElement {
  const span = document.createElement("span");
  span.className = "cm-fnhead__risk";
  span.textContent = String(score);
  return span;
}

/**
 * Stable signature for `WidgetType.eq()` — every value that flows into
 * the rendered DOM must be included so a content change forces re-render.
 * Strings only; nullish becomes empty.
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
    default:
      return "";
  }
}
