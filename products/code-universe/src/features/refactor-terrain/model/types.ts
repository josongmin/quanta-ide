export interface RefactorTerrainRow {
  fileId: string;
  label: string;
  /** Galaxy/street ancestor name for grouping */
  groupLabel: string;
  rank: number;
  /** Overall ROI score 0..100 */
  score: number;
  /** The 5 component scores 0..100 */
  components: {
    churn: number;
    complexity: number;
    fanIn: number;
    testDebt: number;
    cycleMembership: number;
  };
  /** Color for the row's score bar — red=high, green=low */
  barColor: string;
  /** Concise action hint, from RefactorPlan.title */
  suggestion?: string;
  /** Effort derived from RefactorPlan.kind */
  effort?: "low" | "medium" | "high";
}

export interface RefactorTerrainLayout {
  rows: RefactorTerrainRow[];
  /** Total files analyzed */
  totalFiles: number;
  /** Overflow beyond what we show */
  overflow: number;
  /** Max score for normalization */
  maxScore: number;
  /** Component color palette (fixed) */
  componentColors: {
    churn: string;
    complexity: string;
    fanIn: string;
    testDebt: string;
    cycleMembership: string;
  };
}

export interface BuildRefactorTerrainLayoutOpts {
  tree: import("@quanta/canvas-engine").EntityTree;
  graph: import("@quanta/canvas-engine").WorkspaceGraph;
  /** Max rows to show — defaults to 30 */
  maxRows?: number;
}
