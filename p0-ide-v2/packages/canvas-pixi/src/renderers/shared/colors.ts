// Shared risk/severity colour palettes. Consolidating these here keeps the
// semantic mapping (risk score / cyclomatic complexity → fill / border / text)
// in one place so a design tweak doesn't require touching every renderer —
// and so two renderers never drift to slightly-different shades of "high
// risk" that look like a bug at the LOD cross-fade.
//
// Structural colours (backgrounds, invisible hit-layer alpha, muted label
// greys) live alongside their renderer — they aren't part of this semantic
// palette.

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

// Edge palette per FileEdge.kind. Kept here (not in EdgeStaticRenderer) so
// downstream overlays or a future legend panel can read the same mapping.
// Widths are base (world-px at scale=1); the renderer multiplies by invScale
// for scale-independent rendering.
export const EDGE_STYLE = {
  import:               { color: 0x6b7280, alpha: 0.40, baseWidth: 0.6 },
  "taint-propagation":  { color: 0xdc2626, alpha: 0.80, baseWidth: 0.9 },
  blast:                { color: 0xea580c, alpha: 0.70, baseWidth: 0.8 },
} as const;

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
