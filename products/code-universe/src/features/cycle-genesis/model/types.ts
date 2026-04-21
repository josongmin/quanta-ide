// Cycle Genesis types
// --------------------------------------------------------------------
// Pure-data shapes for the "Cycle Birth Timeline" visualization.
// Separation of concerns: buildCycleGenesisLayout produces this layout;
// CycleGenesisView renders it. No graph traversal in React.

import type { EdgeKind } from "@quanta/canvas-engine";

/** One row in the timeline — one non-trivial SCC. */
export interface CycleGenesisRow {
  /** Unique id for this row — derived from sorted SCC members. */
  id: string;
  /** File/node ids that belong to this cycle. */
  sccMembers: readonly string[];
  /** Short display labels for sccMembers, e.g. "vm/store ↔ mm/store". */
  memberLabel: string;
  /** SHA where this cycle first formed. null = pre-dates recorded history. */
  formedAtSha: string | null;
  /** Unix ms timestamp of formation. null = pre-dates history. */
  formedAtTimestamp: number | null;
  /**
   * Normalised x-position [0..1] on the timeline axis.
   * 0 = leftmost / oldest. 1 = rightmost / newest.
   */
  timelineX: number;
  /** Human-readable age label, e.g. "3 months ago". */
  ageLabel: string;
  /** Circle fill colour — red gradient; older = darker. */
  circleColor: string;
  /** Edge that closed the cycle, if identifiable. */
  introducingEdge?: { from: string; to: string; kind: EdgeKind };
  /** Members already connected before the cycle closed. */
  beforeFormation: readonly string[];
  /** True if the cycle pre-dates all recorded history. */
  predatesHistory: boolean;
}

export interface CycleGenesisLayout {
  rows: CycleGenesisRow[];
  /** Earliest formation timestamp across all rows (null if all pre-date history). */
  earliestTimestamp: number | null;
  /** NOW timestamp used as the right end of the time axis. */
  nowTimestamp: number;
}

export interface BuildCycleGenesisLayoutOpts {
  graph: import("@quanta/canvas-engine").WorkspaceGraph;
  /** NOW reference — defaults to Date.now(). Injected for deterministic tests. */
  nowMs?: number;
}
