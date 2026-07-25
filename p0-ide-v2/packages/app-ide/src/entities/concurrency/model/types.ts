/**
 * Concurrency / Race Risk Map — types.
 *
 * Models the per-file happens-before partial order between concurrent
 * accesses to shared state, plus the lock-acquisition order graph used
 * to surface deadlock potential.
 *
 * - `Access.time` is a normalized logical clock on its own lane (0..1).
 *   The happens-before relation across lanes is witnessed by the
 *   separate lock intervals + race pairs computed by the analyzer;
 *   this structure is the analyzer's flattened output, not raw traces.
 * - Two accesses on different lanes form a `RacePair` iff at least
 *   one is a write and their held-lock sets are disjoint.
 * - `deadlockCycles` is any cycle in `lockOrder` (each cycle is a
 *   list of lock ids ending where it started is NOT required —
 *   callers infer closure).
 */

export type AccessKind = "read" | "write";

export interface SharedResource {
  id: string;
  /** Fully-qualified name e.g. `experience_store.trace_cache`. */
  name: string;
  kind: "variable" | "map" | "queue" | "db" | "file";
}

export interface Lock {
  id: string;
  name: string;
}

export interface Access {
  id: string;
  laneId: string;
  resourceId: string;
  kind: AccessKind;
  /** Source line number (1-based). */
  line: number;
  /** Normalized logical position on this lane, 0..1. */
  time: number;
  /** Lock ids held at the moment of this access. */
  locksHeld: string[];
}

export interface Lane {
  id: string;
  label: string;
  kind: "thread" | "async" | "actor";
}

export interface LockInterval {
  laneId: string;
  lockId: string;
  tStart: number;
  tEnd: number;
}

export interface RacePair {
  aId: string;
  bId: string;
  resourceId: string;
  severity: "high" | "mid" | "low";
  reason: string;
}

export interface LockOrderEdge {
  fromLock: string;
  toLock: string;
  /** Lane that witnessed this ordering (for drill-down). */
  witnessLane: string;
  line: number;
}

export interface ConcurrencyMap {
  lanes: Lane[];
  resources: SharedResource[];
  locks: Lock[];
  accesses: Access[];
  lockIntervals: LockInterval[];
  races: RacePair[];
  lockOrder: LockOrderEdge[];
  /** Each entry is an ordered list of lock ids forming a cycle. */
  deadlockCycles: string[][];
}
