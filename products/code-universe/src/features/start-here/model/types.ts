import type { WorkspaceGraph } from "@quanta/canvas-engine";

export interface StartHereRow {
  rank: number;
  fileId: string;
  fileName: string;
  /** Composite score 0..1 */
  score: number;
  /** 0..1 centrality component */
  centrality: number;
  /** 0..1 entry-point component */
  entryPoint: number;
  /** 0..1 risk component */
  risk: number;
  /** Hex color for the ring — green (safe/hub) → red (risky) */
  ringColor: string;
  /** Human-readable heuristic label */
  description: string;
}

export interface StartHereLayout {
  rows: StartHereRow[];
  totalFiles: number;
}

export interface BuildStartHereLayoutOpts {
  graph: WorkspaceGraph;
  /** Top N to rank. Default 12. */
  topN?: number;
}
