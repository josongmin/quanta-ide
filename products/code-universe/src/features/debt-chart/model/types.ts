import type { DebtSnapshot, WorkspaceGraph } from "@quanta/canvas-engine";

export interface DebtSeries {
  /** Metric name for display */
  label: string;
  /** Internal key */
  key: "sccCount" | "archViolationCount" | "edgeCount" | "fileCount" | "avgCpx";
  /** Color for this line */
  color: string;
  /** Whether this is a "bad" metric (higher = worse) */
  isDebtMetric: boolean;
  /** Normalized 0..1 data points, one per snapshot */
  points: Array<{ t: number; v: number; raw: number; sha: string; timestamp: number }>;
  /** Current (last) raw value */
  currentValue: number;
  /** Delta from first to last snapshot (positive = got worse) */
  delta: number;
}

export interface DebtChartLayout {
  series: DebtSeries[];
  snapshots: DebtSnapshot[];
  /** Total commits in history */
  snapshotCount: number;
  /** Whether git history was available */
  hasHistory: boolean;
  /** Width/height for the chart area (minus labels) */
  plotWidth: number;
  plotHeight: number;
  /** Padding offsets */
  padLeft: number;
  padTop: number;
  padRight: number;
  padBottom: number;
}

export interface BuildDebtChartLayoutOpts {
  graph: WorkspaceGraph;
  width: number;
  height: number;
  /** Which series to show — defaults to all */
  enabledKeys?: Array<DebtSeries["key"]>;
}
