import { StateField, StateEffect } from "@codemirror/state";
import { GutterMarker, gutter } from "@codemirror/view";
import type { LineMeta } from "@/app/ide/mock-source";

/* ═══════════════════════════════════════════════════════════════════════
   Shared line-meta state — drives all gutter markers & decorations
   ═══════════════════════════════════════════════════════════════════════ */
export const setLineMeta = StateEffect.define<Record<number, LineMeta>>();

export const lineMetaField = StateField.define<Record<number, LineMeta>>({
  create: () => ({}),
  update(value, tr) {
    for (const e of tr.effects) {
      if (e.is(setLineMeta)) return e.value;
    }
    return value;
  },
});

/* ═══════════════════════════════════════════════════════════════════════
   Risk gutter
   ═══════════════════════════════════════════════════════════════════════ */
class RiskMarker extends GutterMarker {
  risk: 1 | 2 | 3 | 4;
  constructor(risk: 1 | 2 | 3 | 4) { super(); this.risk = risk; }
  override toDOM(): HTMLElement {
    const el = document.createElement("div");
    el.className = `cm-risk-marker cm-risk-${this.risk}`;
    return el;
  }
}

export const riskGutter = gutter({
  class: "cm-risk-gutter",
  lineMarker(view, line) {
    const meta = view.state.field(lineMetaField);
    const lineNo = view.state.doc.lineAt(line.from).number;
    const m = meta[lineNo] as LineMeta | undefined;
    if (m?.risk) return new RiskMarker(m.risk);
    return null;
  },
});

/* ═══════════════════════════════════════════════════════════════════════
   Coverage gap gutter — red marker for uncovered lines
   ═══════════════════════════════════════════════════════════════════════ */
class CoverageMarker extends GutterMarker {
  override toDOM(): HTMLElement {
    const el = document.createElement("div");
    el.className = "cm-coverage-marker";
    return el;
  }
}

export const coverageGutter = gutter({
  class: "cm-coverage-gutter",
  lineMarker(view, line) {
    const meta = view.state.field(lineMetaField);
    const lineNo = view.state.doc.lineAt(line.from).number;
    const m = meta[lineNo] as LineMeta | undefined;
    if (m?.uncovered) return new CoverageMarker();
    return null;
  },
});

/* ═══════════════════════════════════════════════════════════════════════
   Churn heatmap gutter — intensity-based accent bar
   ═══════════════════════════════════════════════════════════════════════ */
class ChurnMarker extends GutterMarker {
  intensity: number;
  constructor(intensity: number) { super(); this.intensity = intensity; }
  override toDOM(): HTMLElement {
    const el = document.createElement("div");
    el.className = "cm-churn-marker";
    const alpha = Math.round(this.intensity * 45);
    el.style.backgroundColor = `color-mix(in srgb, var(--accent) ${alpha.toString()}%, transparent)`;
    return el;
  }
}

export const churnGutter = gutter({
  class: "cm-churn-gutter",
  lineMarker(view, line) {
    const meta = view.state.field(lineMetaField);
    const lineNo = view.state.doc.lineAt(line.from).number;
    const m = meta[lineNo] as LineMeta | undefined;
    if (m?.churn !== undefined && m.churn > 0) return new ChurnMarker(m.churn);
    return null;
  },
});
