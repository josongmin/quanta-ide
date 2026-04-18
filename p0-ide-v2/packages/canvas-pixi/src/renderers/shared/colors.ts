// Shared risk/severity colour palettes. Consolidating these here keeps the
// semantic mapping (risk score / cyclomatic complexity → fill / border / text)
// in one place so a design tweak doesn't require touching every renderer —
// and so two renderers never drift to slightly-different shades of "high
// risk" that look like a bug at the LOD cross-fade.
//
// Structural colours (backgrounds, invisible hit-layer alpha, muted label
// greys) live alongside their renderer — they aren't part of this semantic
// palette.

import type { EdgeKind, EdgeLayer, EdgeSeverity } from "@quanta/canvas-engine";
import { clamp, deriveEdgeLayer } from "@quanta/canvas-engine";

// Thresholds mirror the existing inline conditions: >=70 high, >=40 medium,
// else low. Centralising the constants means a future "move the boundary"
// change is a one-line edit.
export const RISK_THRESHOLD_HIGH = 70;
export const RISK_THRESHOLD_MEDIUM = 40;

// Cyclomatic-complexity boundaries used by function-block fills inside city
// cards. Same shape as risk, different numeric bands.
export const COMPLEXITY_THRESHOLD_HIGH = 10;
export const COMPLEXITY_THRESHOLD_MEDIUM = 5;

// File-level risk palette — used by galaxy + city card backgrounds and
// borders, plus the city-level risk-score text colour.
export const RISK_FILL = {
  high: 0xfee2e2,
  medium: 0xfef3c7,
  low: 0xdcfce7,
} as const;

export const RISK_BORDER = {
  high: 0xfca5a5,
  medium: 0xfcd34d,
  low: 0x86efac,
} as const;

export const RISK_TEXT = {
  high: 0xdc2626,
  medium: 0xd97706,
  low: 0x16a34a,
} as const;

// Function-block palette — city renderer paints one mini-rect per function
// coloured by its cyclomatic complexity. Shares the "green → amber → red"
// semantic vocabulary as risk but with softer low/medium tones because the
// blocks sit inside an already-coloured card.
export const COMPLEXITY_FILL = {
  high: 0xfee2e2,
  medium: 0xfef3c7,
  low: 0xf0fdf4,
} as const;

export const COMPLEXITY_BORDER = {
  high: 0xfca5a5,
  medium: 0xfde68a,
  low: 0xbbf7d0,
} as const;

// Selection / hover accent — indigo-500 from the design system. Separate
// from risk because a *selected* high-risk node should still read as
// selected first, risk second.
export const SELECTION_ACCENT = 0x4f46e5;

// Signal-count / taint accent — matches RISK_TEXT.high because a positive
// signal count is itself a risk indicator and users expect the two to agree.
export const SIGNAL_ACCENT = 0xdc2626;

// Architecture-violation halo drawn around offending file cards. Same hue
// as SIGNAL_ACCENT by design — both say "this needs attention".
export const VIOLATION_HALO = 0xdc2626;

// Cross-graph / cross-repo join edges (safety-yellow).
export const CROSS_GRAPH_ACCENT = 0xfacc15;

/**
 * Design-token namespace consumable by CSS-in-JS or build-time emitters.
 * Mirrors the `:root` CSS variables declared in
 * `app-ide/src/features/workspace-canvas/workspace-canvas.css`. Keep the two
 * lists in sync — if you add or remove a semantic token here, update the CSS
 * block too.
 */
export const DESIGN_TOKENS = {
  selectionAccent: SELECTION_ACCENT,
  signalAccent: SIGNAL_ACCENT,
  violationHalo: VIOLATION_HALO,
  crossGraph: CROSS_GRAPH_ACCENT,
  riskHigh: RISK_TEXT.high,
  riskMedium: RISK_TEXT.medium,
  riskLow: RISK_TEXT.low,
} as const;

// Edge styling is a two-level registry so the renderer can gracefully handle
// ~19 analyzer-defined kinds without forcing every kind to have a bespoke
// entry. `LAYER_STYLE` is the per-plane default; `KIND_STYLE` holds the
// overrides that deviate from the plane's baseline. Kept here (not in
// EdgeStaticRenderer) so downstream overlays or a future legend panel can
// read the same mapping. Widths are base (world-px at scale=1); the
// renderer multiplies by invScale for scale-independent rendering.
export interface EdgeStyle {
  color: number;
  alpha: number;
  baseWidth: number;
  /** Dash pattern in world-px — optional; see resolveEdgeStyle docs. */
  dash?: readonly [on: number, off: number];
  cap?: "round" | "butt";
}

// Defaults chosen so a brand-new kind within a plane renders in that plane's
// visual vocabulary immediately — grey for structural, cyan for flow, red for
// safety, purple for impact. `call` is the structural archetype; `dataflow`
// for flow; `taint-propagation` for safety; `impact` for impact.
export const LAYER_STYLE: Record<EdgeLayer, EdgeStyle> = {
  structural: { color: 0x6b7280, alpha: 0.45, baseWidth: 0.6 },
  flow:       { color: 0x22d3ee, alpha: 0.60, baseWidth: 0.7 },
  safety:     { color: 0xdc2626, alpha: 0.85, baseWidth: 1.0 },
  impact:     { color: 0xa855f7, alpha: 0.80, baseWidth: 1.0 },
};

export const KIND_STYLE: Partial<Record<EdgeKind, EdgeStyle>> = {
  // structural
  import:               { color: 0x9ca3af, alpha: 0.35, baseWidth: 0.5 },
  call:                 { color: 0x6b7280, alpha: 0.45, baseWidth: 0.6 },
  reference:            { color: 0x9ca3af, alpha: 0.25, baseWidth: 0.4, dash: [3, 3] },
  inheritance:          { color: 0x93c5fd, alpha: 0.55, baseWidth: 0.7 },
  cfg:                  { color: 0x6b7280, alpha: 0.30, baseWidth: 0.4 },
  // flow
  dataflow:             { color: 0x22d3ee, alpha: 0.60, baseWidth: 0.7 },
  effect:               { color: 0x14b8a6, alpha: 0.55, baseWidth: 0.6, dash: [2, 2] },
  pdg:                  { color: 0x6366f1, alpha: 0.55, baseWidth: 0.6 },
  alias:                { color: 0xa78bfa, alpha: 0.50, baseWidth: 0.5, dash: [1, 2] },
  // safety
  "taint-propagation":  { color: 0xdc2626, alpha: 0.85, baseWidth: 1.0 },
  sanitizer:            { color: 0x16a34a, alpha: 0.80, baseWidth: 0.9 },
  race:                 { color: 0xec4899, alpha: 0.80, baseWidth: 0.9 },
  cycle:                { color: 0xea580c, alpha: 0.85, baseWidth: 1.0 },
  finding:              { color: 0xb91c1c, alpha: 0.90, baseWidth: 1.1 },
  // impact
  impact:               { color: 0xa855f7, alpha: 0.80, baseWidth: 1.0 },
  blast:                { color: 0xf59e0b, alpha: 0.75, baseWidth: 0.9 },
  diff:                 { color: 0x8b5cf6, alpha: 0.75, baseWidth: 0.8 },
  dependency:           { color: 0x3b82f6, alpha: 0.75, baseWidth: 0.8 },
  witness:              { color: 0xfacc15, alpha: 0.90, baseWidth: 1.1 },
};

// Severity rank used both here (critical bump) and by the renderer's
// `minSeverity` filter. Exported so the store/HUD can share the ordering.
export const SEVERITY_RANK: Record<EdgeSeverity, number> = {
  low: 0, medium: 1, high: 2, critical: 3,
};

export const CROSS_GRAPH_STYLE: EdgeStyle = {
  color: CROSS_GRAPH_ACCENT,
  alpha: 0.85,
  baseWidth: 1.2,
  dash: [8, 5],
};

/**
 * Resolve a stroke style for a single edge.
 * - KIND_STYLE wins over LAYER_STYLE[deriveEdgeLayer(kind)].
 * - `severity === "critical"` bumps alpha by +0.10 (clamped to 1) and
 *   multiplies width by 1.25 — critical findings visibly dominate even
 *   when the kind's baseline is muted.
 * - `confidence` multiplies width by clamp(confidence, 0.5, 1.5); we clamp
 *   because arbitrarily thin lines vanish at typical zooms and arbitrarily
 *   thick ones drown out the rest of the graph.
 */
export function resolveEdgeStyle(edge: {
  kind: EdgeKind;
  layer: EdgeLayer;
  confidence?: number;
  severity?: EdgeSeverity;
}): EdgeStyle {
  const base: EdgeStyle = KIND_STYLE[edge.kind] ?? LAYER_STYLE[edge.layer] ?? LAYER_STYLE[deriveEdgeLayer(edge.kind)];
  let { color, alpha, baseWidth, dash, cap } = base;
  if (edge.severity === "critical") {
    alpha = clamp(alpha + 0.10, 0, 1);
    baseWidth = baseWidth * 1.25;
  }
  if (typeof edge.confidence === "number") {
    baseWidth = baseWidth * clamp(edge.confidence, 0.5, 1.5);
  }
  return { color, alpha, baseWidth, dash, cap };
}

export function riskFill(score: number): number {
  if (score >= RISK_THRESHOLD_HIGH) return RISK_FILL.high;
  if (score >= RISK_THRESHOLD_MEDIUM) return RISK_FILL.medium;
  return RISK_FILL.low;
}

export function riskBorder(score: number): number {
  if (score >= RISK_THRESHOLD_HIGH) return RISK_BORDER.high;
  if (score >= RISK_THRESHOLD_MEDIUM) return RISK_BORDER.medium;
  return RISK_BORDER.low;
}

export function riskText(score: number): number {
  if (score >= RISK_THRESHOLD_HIGH) return RISK_TEXT.high;
  if (score >= RISK_THRESHOLD_MEDIUM) return RISK_TEXT.medium;
  return RISK_TEXT.low;
}

export function complexityFill(cpx: number): number {
  if (cpx >= COMPLEXITY_THRESHOLD_HIGH) return COMPLEXITY_FILL.high;
  if (cpx >= COMPLEXITY_THRESHOLD_MEDIUM) return COMPLEXITY_FILL.medium;
  return COMPLEXITY_FILL.low;
}

export function complexityBorder(cpx: number): number {
  if (cpx >= COMPLEXITY_THRESHOLD_HIGH) return COMPLEXITY_BORDER.high;
  if (cpx >= COMPLEXITY_THRESHOLD_MEDIUM) return COMPLEXITY_BORDER.medium;
  return COMPLEXITY_BORDER.low;
}
