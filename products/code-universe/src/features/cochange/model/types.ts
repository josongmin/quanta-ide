import type { WorkspaceGraph } from "@quanta/canvas-engine";

// ── Cell ─────────────────────────────────────────────────────────────

/** One cell in the N×N co-change matrix. */
export interface CoChangeCell {
  fileA: string;
  fileB: string;
  nameA: string;
  nameB: string;
  /** How many snapshot pairs both files changed together. */
  cochangeCount: number;
  /** How many snapshot pairs either file changed. */
  totalSnapshots: number;
  /** cochangeCount / totalSnapshots — 0..1. */
  ratio: number;
  /** Interpolated hex color — bg1 (ratio=0) to #3b82f6 (ratio=1). */
  color: string;
}

// ── Layout ───────────────────────────────────────────────────────────

export interface CoChangeLayout {
  /** Sparse upper-triangle cells (i < j) only; diagonal excluded. */
  cells: CoChangeCell[];
  /** Ordered file IDs, length ≤ 15. */
  fileOrder: string[];
  /** Ordered file display names, aligned with fileOrder. */
  fileNames: string[];
  /** Whether graph.history was present. */
  hasHistory: boolean;
  /** Total consecutive snapshot pairs examined. */
  totalSnapshots: number;
}

// ── Build options ─────────────────────────────────────────────────────

export interface BuildCoChangeLayoutOpts {
  graph: WorkspaceGraph;
  /** Max distinct files tracked. Defaults to 15. */
  maxFiles?: number;
}
