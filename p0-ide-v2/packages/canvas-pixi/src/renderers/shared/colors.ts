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

// Semantic red-600 aliases — same hex today (0xdc2626), but each name
// tracks a distinct concern so design can diverge one without touching
// the others.
export const SAFETY_RED = 0xdc2626;
export const VIOLATION_RED = 0xdc2626;
export const RISK_HIGH_RED = 0xdc2626;

// Shared neutral / flow / cycle hues — each previously duplicated across
// three or more renderers. Naming here means a design tweak lands in one
// place.
export const NEUTRAL_GREY = 0x6b7280;
export const FLOW_CYAN = 0x22d3ee;
export const CYCLE_ORANGE = 0xea580c;

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
  high: RISK_HIGH_RED,
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
export const SIGNAL_ACCENT = SAFETY_RED;

// Architecture-violation halo drawn around offending file cards. Same hue
// as SIGNAL_ACCENT by design — both say "this needs attention".
export const VIOLATION_HALO = VIOLATION_RED;

// Cross-graph / cross-repo join edges (safety-yellow).
export const CROSS_GRAPH_ACCENT = 0xfacc15;

// Refactor-ROI terrain ramp: green → amber → red. Shared with CSS
// `--ws-roi-*` tokens so Pixi bars and DOM panel agree on the ramp.
export const ROI_COLD = 0x22c55e;
export const ROI_WARM = 0xfacc15;
export const ROI_HOT = 0xef4444;

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
  riskHigh: RISK_HIGH_RED,
  riskMedium: RISK_TEXT.medium,
  riskLow: RISK_TEXT.low,
  roiCold: ROI_COLD,
  roiWarm: ROI_WARM,
  roiHot: ROI_HOT,
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
  /**
   * Dash pattern in world-px — supports arbitrary-length alternation so
   * individual kinds can read as dash-dot, dot-dot-dash, train-track etc.
   * Even indices are "pen down" segments, odd indices are "pen up" gaps.
   * A two-tuple `[on, off]` is still the common case; longer arrays like
   * `[6, 2, 1, 2]` give distinct silhouettes at a glance.
   */
  dash?: readonly number[];
  cap?: "round" | "butt";
  /**
   * Bezier control-point spread multiplier. 0.35 is the default "gentle
   * arc"; raising it (0.6–0.9) makes the edge bow further away from the
   * straight line so a reader can tell "this is a cycle" or "this is a
   * taint detour" without reading the colour. Dropping to 0.15 gives a
   * near-straight line for background relations (import/reference).
   */
  curveFactor?: number;
}

// Defaults chosen so a brand-new kind within a plane renders in that plane's
// visual vocabulary immediately — grey for structural, cyan for flow, red for
// safety, purple for impact. `call` is the structural archetype; `dataflow`
// for flow; `taint-propagation` for safety; `impact` for impact.
export const LAYER_STYLE: Record<EdgeLayer, EdgeStyle> = {
  structural: { color: NEUTRAL_GREY, alpha: 0.45, baseWidth: 0.6 },
  flow:       { color: FLOW_CYAN,    alpha: 0.60, baseWidth: 0.7 },
  safety:     { color: SAFETY_RED,   alpha: 0.85, baseWidth: 1.0 },
  impact:     { color: 0xa855f7,     alpha: 0.80, baseWidth: 1.0 },
};

// Categorical palette designed for at-a-glance discrimination. Each kind
// gets four visual dimensions tuned so they don't collide:
//   - hue           — tableau-20-like wheel, no adjacent kinds share one
//   - width         — 0.3 (ambient) … 2.0 (critical signal)
//   - dash          — solid | dot | short | long | dash-dot | train-track
//                     (multi-segment [on, off, on, off, ...] supported)
//   - curveFactor   — 0.10 near-straight … 0.95 deep arc, so different
//                     kinds bow away from each other even when routed
//                     between the same two cards
//   - animated      — only set on kinds with directional "flow" semantics
//                     (handled in the edge list, not here)
//
// Layers read as families (structural=quiet, flow=cyan/indigo, safety=red
// family, impact=gold/purple) while keeping every kind individually
// readable. Two "background" kinds (import, reference) stay intentionally
// dim+thin so they don't drown the signal edges.
export const KIND_STYLE: Partial<Record<EdgeKind, EdgeStyle>> = {
  // ── structural ────────────────────────────────────────────────────
  import:               { color: 0xcbd5e1, alpha: 0.30, baseWidth: 0.35,                                          curveFactor: 0.15 },
  call:                 { color: 0x475569, alpha: 0.65, baseWidth: 0.70,                                          curveFactor: 0.25 },
  reference:            { color: 0xd1d5db, alpha: 0.28, baseWidth: 0.35, dash: [2, 3],                            curveFactor: 0.15 },
  inheritance:          { color: 0x1d4ed8, alpha: 0.90, baseWidth: 1.10,                                          curveFactor: 0.10 },
  cfg:                  { color: 0x94a3b8, alpha: 0.40, baseWidth: 0.40, dash: [1, 2],                            curveFactor: 0.20 },
  "test-covers":        { color: 0x10b981, alpha: 0.90, baseWidth: 0.85, dash: [5, 2, 1, 2],                      curveFactor: 0.45 },
  clone:                { color: 0xfb7185, alpha: 0.85, baseWidth: 0.80, dash: [2, 2, 2, 6],                      curveFactor: 0.55, cap: "round" },
  // ── flow ──────────────────────────────────────────────────────────
  dataflow:             { color: 0x06b6d4, alpha: 0.90, baseWidth: 0.95,                                          curveFactor: 0.40, cap: "round" },
  effect:               { color: 0x0d9488, alpha: 0.80, baseWidth: 0.75, dash: [3, 2],                            curveFactor: 0.50 },
  pdg:                  { color: 0x4f46e5, alpha: 0.90, baseWidth: 0.90, dash: [7, 2, 1, 2],                      curveFactor: 0.35 },
  alias:                { color: 0xa78bfa, alpha: 0.80, baseWidth: 0.65, dash: [1, 3],                            curveFactor: 0.80 },
  "feature-flag":       { color: 0xfbbf24, alpha: 0.95, baseWidth: 1.00, dash: [8, 3],                            curveFactor: 0.30, cap: "round" },
  // ── safety ────────────────────────────────────────────────────────
  "taint-propagation":  { color: 0xdc2626, alpha: 0.95, baseWidth: 1.40,                                          curveFactor: 0.70, cap: "round" },
  sanitizer:            { color: 0x16a34a, alpha: 0.95, baseWidth: 1.20,                                          curveFactor: 0.25 },
  race:                 { color: 0xec4899, alpha: 0.95, baseWidth: 1.15, dash: [3, 2, 1, 2, 1, 2],                curveFactor: 0.85, cap: "round" },
  cycle:                { color: 0xea580c, alpha: 0.95, baseWidth: 1.30,                                          curveFactor: 0.95, cap: "round" },
  finding:              { color: 0xb91c1c, alpha: 1.00, baseWidth: 1.60, dash: [10, 3, 2, 3],                     curveFactor: 0.55 },
  contract:             { color: 0x7c3aed, alpha: 0.90, baseWidth: 1.00, dash: [6, 2, 2, 2],                      curveFactor: 0.30 },
  "dead-edge":          { color: 0x9ca3af, alpha: 0.25, baseWidth: 0.40, dash: [1, 5],                            curveFactor: 0.20 },
  "runtime-divergence": { color: 0xe11d48, alpha: 1.00, baseWidth: 1.40, dash: [6, 2, 1, 2, 1, 2],                curveFactor: 0.75, cap: "round" },
  // ── impact ────────────────────────────────────────────────────────
  impact:               { color: 0xa855f7, alpha: 0.90, baseWidth: 1.15,                                          curveFactor: 0.40 },
  blast:                { color: 0xf59e0b, alpha: 0.95, baseWidth: 1.30,                                          curveFactor: 0.65, cap: "round" },
  diff:                 { color: 0x8b5cf6, alpha: 0.85, baseWidth: 0.85, dash: [5, 2],                            curveFactor: 0.30 },
  dependency:           { color: 0x1d4ed8, alpha: 0.90, baseWidth: 1.00,                                          curveFactor: 0.15 },
  witness:              { color: 0xfacc15, alpha: 1.00, baseWidth: 1.50, dash: [2, 2],                            curveFactor: 0.60, cap: "round" },
  cochange:             { color: 0xb45309, alpha: 0.50, baseWidth: 0.55, dash: [3, 3, 1, 3],                      curveFactor: 0.40 },
  "rename-pair":        { color: 0x38bdf8, alpha: 0.85, baseWidth: 0.75, dash: [10, 2, 2, 2],                     curveFactor: 0.70 },
  "supply-chain":       { color: 0xc2410c, alpha: 1.00, baseWidth: 1.50, dash: [1, 2],                            curveFactor: 0.55, cap: "round" },
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
  let { color, alpha, baseWidth, dash, cap, curveFactor } = base;
  if (edge.severity === "critical") {
    alpha = clamp(alpha + 0.10, 0, 1);
    baseWidth = baseWidth * 1.25;
  }
  if (typeof edge.confidence === "number") {
    baseWidth = baseWidth * clamp(edge.confidence, 0.5, 1.5);
  }
  return { color, alpha, baseWidth, dash, cap, curveFactor };
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
