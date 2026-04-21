// Smell History types
// --------------------------------------------------------------------
// Pure-data shapes for the "Smell History" visualization.
// Separation of concerns: buildSmellHistoryLayout produces this layout;
// SmellHistoryView renders it. No graph traversal in React.

import type { SmellKind } from "@quanta/canvas-engine";

export type { SmellKind };

/** One resolved smell entry for a file. */
export interface SmellHistoryEntry {
  /** Unique id: `${fileId}::${smell}` */
  id: string;
  fileId: string;
  /** Short display name, e.g. "vm/store" */
  fileName: string;
  smell: SmellKind;
  /** Unix ms timestamp when this smell first appeared. */
  firstSeenTimestamp: number;
  /** Human-readable relative age, e.g. "3 weeks ago". */
  age: string;
  /** Dot/accent colour for this smell kind. */
  color: string;
  /** The SHA where the smell first appeared. */
  firstSeenSha: string;
}

/**
 * Sparkline bucket — one bucket per snapshot sampled from history.
 * Value = count of active smells at that bucket index.
 */
export interface SparklineBucket {
  index: number;
  count: number;
  timestamp: number;
}

/** All data needed to render the SmellHistoryView. */
export interface SmellHistoryLayout {
  /** All entries, sorted by firstSeenTimestamp descending (newest first). */
  entries: SmellHistoryEntry[];
  /** Bucketed sparkline data — 12 evenly-spaced samples from history. */
  sparkline: SparklineBucket[];
  /** Map from smell kind to its entries (same references as `entries`). */
  byKind: Map<SmellKind, SmellHistoryEntry[]>;
}

export interface BuildSmellHistoryLayoutOpts {
  graph: import("@quanta/canvas-engine").WorkspaceGraph;
  /** Max files to analyse by riskScore. Default 20. */
  topN?: number;
  /** Overrides for smell detection thresholds. */
  couplingThreshold?: number;
  riskDeltaThreshold?: number;
  /** NOW reference for age labels. Defaults to Date.now(). */
  nowMs?: number;
}
