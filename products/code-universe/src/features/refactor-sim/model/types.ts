import type { RefactorPlanKind } from "@quanta/canvas-engine";
import type { WorkspaceGraph } from "@quanta/canvas-engine";

export interface RefactorSimRow {
  /** 1-based rank by absolute delta magnitude */
  rank: number;
  fileId: string;
  fileName: string;
  kind: RefactorPlanKind;
  /** Current ROI score 0..100 */
  score: number;
  /** Simulated total-terrain delta (negative = improvement) */
  projectedDelta: number;
  affectedCount: number;
  /** 0..1 */
  confidence: number;
  effort: string;
  /** Color for the kind badge */
  barColor: string;
  /** Affected fileIds + their individual per-file deltas */
  affectedDetails: ReadonlyArray<{ fileId: string; delta: number }>;
}

export interface RefactorSimLayout {
  rows: RefactorSimRow[];
  /** Best-plan summary text, or null when empty */
  bestMoveSummary: string | null;
  totalFiles: number;
}

export interface BuildRefactorSimLayoutOpts {
  graph: WorkspaceGraph;
  /** Max number of plans to show. Default 15. */
  maxPlans?: number;
}
