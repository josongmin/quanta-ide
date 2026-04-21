// Churn × Risk quadrant scatter plot — model types.
// --------------------------------------------------------------------
// A McKinsey-style "Risk Heatmap" that plots workspace entities (by
// default galaxies = packages) by two axes:
//   X = churn   — how frequently the entity's files changed recently
//   Y = risk    — aggregated risk score from engine signals
//
// The 2×2 quadrant partition gives four named zones:
//   Danger Zone   — high churn, high risk   → urgent attention
//   Active Work   — high churn, low risk    → healthy iteration
//   Tech Debt     — low churn, high risk    → buried landmine
//   Stable        — low churn, low risk     → well-maintained
//
// Pure-data-in / pure-data-out: `buildQuadrantLayout` returns a
// QuadrantLayout and the SVG renderer paints from that. No tree/graph
// traversal happens in React, and determinism is testable without
// rendering.

import type { EntityKind } from "@quanta/canvas-engine";

/** A single plotted entity (galaxy, building, etc.). */
export interface QuadrantPoint {
  id: string;
  label: string;
  kind: EntityKind;
  /** 0..1 normalized churn (higher = more recently changed) */
  x: number;
  /** 0..1 normalized risk (higher = more dangerous) */
  y: number;
  xRaw: number;  // raw churn value before normalization
  yRaw: number;  // raw risk value before normalization
  color: string;
  /** Radius in SVG units, proportional to loc */
  radius: number;
  /** Sublabel — e.g. "12 files · risk 0.74" */
  sublabel: string;
}

export type QuadrantId =
  | "volatile-critical"
  | "volatile-safe"
  | "stable-critical"
  | "stable-safe";

export interface QuadrantRegion {
  id: QuadrantId;
  label: string;
  description: string;
  /** 0 = left half, 1 = right half of the plot area */
  xHalf: 0 | 1;
  /** 0 = bottom half, 1 = top half of the plot area */
  yHalf: 0 | 1;
  /** Background tint in SVG */
  fill: string;
}

export interface QuadrantLayout {
  points: QuadrantPoint[];
  regions: QuadrantRegion[];
  /** Label for horizontal axis */
  xAxisLabel: string;
  /** Label for vertical axis */
  yAxisLabel: string;
  /** How many entities were above maxPoints and trimmed */
  overflow: number;
}

export interface BuildQuadrantLayoutOpts {
  tree: import("@quanta/canvas-engine").EntityTree;
  graph: import("@quanta/canvas-engine").WorkspaceGraph;
  width: number;
  height: number;
  /** Which entity kind to plot — defaults to "galaxy" */
  pointKind?: "galaxy" | "building";
  /** Scope to a subtree — null = workspace root */
  scopeId?: string | null;
  /** Max points before trimming low-risk/low-churn tail — defaults to 80 */
  maxPoints?: number;
}
