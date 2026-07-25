export type TestConfidence = "high" | "medium" | "low";

export interface ChangedFile {
  path: string;
  /** + lines added, - lines removed (display only). */
  added: number;
  removed: number;
  /** Distance to nearest test in dependency graph (0 = test exists in same file). */
  testDistance: number;
}

export interface TestSelection {
  id: string;
  /** Test file path. */
  path: string;
  /** Test name(s) within the file (or "*" for all). */
  cases: string[];
  /** Why this test was selected — anchors the trust judgement. */
  reason: string;
  /** Confidence in selection. */
  confidence: TestConfidence;
  /** Estimated wall time to run, ms. */
  estMs: number;
  /** Reachability distance from changed files (lower = more direct). */
  distance: number;
}

export interface TestImpactPlan {
  /** SHA range or PR id this plan was computed from. */
  baseRef: string;
  /** Total tests in suite (denominator). */
  totalTests: number;
  /** Average full-suite duration, ms. */
  fullSuiteMs: number;
  changed: ChangedFile[];
  selected: TestSelection[];
  /** Confidence in safe-subset claim — derived. */
  overallConfidence: TestConfidence;
  /** True when the plan's safe-subset is empty (must run full suite). */
  fallbackToFull: boolean;
}
