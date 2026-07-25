import type { ConcurrencyMap } from "../model/types";

/**
 * Showcase file: three concurrent contexts contending on a trace cache
 * and experience store. Two races (1 high W/W, 1 mid W/R) and one
 * AB-BA deadlock cycle between `cache_lock` and `store_lock`.
 */
const orchestrator: ConcurrencyMap = {
  lanes: [
    { id: "worker-0", label: "worker-0", kind: "thread" },
    { id: "api-handler", label: "api-handler", kind: "async" },
    { id: "background-flusher", label: "background-flusher", kind: "actor" },
  ],
  resources: [
    { id: "trace_cache", name: "experience_store.trace_cache", kind: "map" },
    { id: "experience_store", name: "experience_store.records", kind: "db" },
    { id: "metrics_counter", name: "metrics.request_count", kind: "variable" },
  ],
  locks: [
    { id: "cache_lock", name: "cache_lock" },
    { id: "store_lock", name: "store_lock" },
  ],
  accesses: [
    // worker-0: acquires cache_lock, then tries store_lock (AB)
    { id: "a1", laneId: "worker-0", resourceId: "trace_cache", kind: "write", line: 112, time: 0.12, locksHeld: ["cache_lock"] },
    { id: "a2", laneId: "worker-0", resourceId: "experience_store", kind: "write", line: 128, time: 0.32, locksHeld: ["cache_lock", "store_lock"] },
    { id: "a3", laneId: "worker-0", resourceId: "metrics_counter", kind: "write", line: 141, time: 0.55, locksHeld: [] },

    // api-handler: acquires store_lock, then tries cache_lock (BA) → deadlock pair
    { id: "a4", laneId: "api-handler", resourceId: "experience_store", kind: "read", line: 204, time: 0.18, locksHeld: ["store_lock"] },
    { id: "a5", laneId: "api-handler", resourceId: "trace_cache", kind: "write", line: 219, time: 0.40, locksHeld: ["store_lock", "cache_lock"] },
    { id: "a6", laneId: "api-handler", resourceId: "metrics_counter", kind: "write", line: 232, time: 0.70, locksHeld: [] },

    // background-flusher: unlocked writes → genuine races
    { id: "a7", laneId: "background-flusher", resourceId: "trace_cache", kind: "write", line: 301, time: 0.25, locksHeld: [] },
    { id: "a8", laneId: "background-flusher", resourceId: "experience_store", kind: "read", line: 318, time: 0.48, locksHeld: [] },
    { id: "a9", laneId: "background-flusher", resourceId: "metrics_counter", kind: "write", line: 327, time: 0.82, locksHeld: [] },
  ],
  lockIntervals: [
    { laneId: "worker-0", lockId: "cache_lock", tStart: 0.08, tEnd: 0.36 },
    { laneId: "worker-0", lockId: "store_lock", tStart: 0.26, tEnd: 0.36 },
    { laneId: "api-handler", lockId: "store_lock", tStart: 0.14, tEnd: 0.44 },
    { laneId: "api-handler", lockId: "cache_lock", tStart: 0.34, tEnd: 0.44 },
  ],
  races: [
    {
      aId: "a7",
      bId: "a1",
      resourceId: "trace_cache",
      severity: "high",
      reason: "write/write, no shared lock",
    },
    {
      aId: "a9",
      bId: "a3",
      resourceId: "metrics_counter",
      severity: "mid",
      reason: "write/write on unsynchronized counter",
    },
  ],
  lockOrder: [
    { fromLock: "cache_lock", toLock: "store_lock", witnessLane: "worker-0", line: 128 },
    { fromLock: "store_lock", toLock: "cache_lock", witnessLane: "api-handler", line: 219 },
  ],
  deadlockCycles: [["cache_lock", "store_lock", "cache_lock"]],
};

/**
 * Single-lock, 2-lane contention. One race (writer vs reader, no lock
 * on the reader side). No deadlock potential.
 */
const routingPolicy: ConcurrencyMap = {
  lanes: [
    { id: "router", label: "router", kind: "async" },
    { id: "reloader", label: "policy-reloader", kind: "thread" },
  ],
  resources: [{ id: "policy_table", name: "policy.table", kind: "map" }],
  locks: [{ id: "policy_lock", name: "policy_lock" }],
  accesses: [
    { id: "r1", laneId: "router", resourceId: "policy_table", kind: "read", line: 44, time: 0.22, locksHeld: [] },
    { id: "r2", laneId: "router", resourceId: "policy_table", kind: "read", line: 61, time: 0.58, locksHeld: ["policy_lock"] },
    { id: "r3", laneId: "reloader", resourceId: "policy_table", kind: "write", line: 118, time: 0.30, locksHeld: ["policy_lock"] },
  ],
  lockIntervals: [
    { laneId: "router", lockId: "policy_lock", tStart: 0.52, tEnd: 0.66 },
    { laneId: "reloader", lockId: "policy_lock", tStart: 0.24, tEnd: 0.40 },
  ],
  races: [
    {
      aId: "r1",
      bId: "r3",
      resourceId: "policy_table",
      severity: "mid",
      reason: "unlocked read races writer",
    },
  ],
  lockOrder: [],
  deadlockCycles: [],
};

/**
 * Two lanes, two resources, zero locks — one guaranteed high race.
 */
const security: ConcurrencyMap = {
  lanes: [
    { id: "request", label: "request-ctx", kind: "async" },
    { id: "audit", label: "audit-sink", kind: "actor" },
  ],
  resources: [
    { id: "token_cache", name: "auth.token_cache", kind: "map" },
    { id: "audit_buffer", name: "audit.buffer", kind: "queue" },
  ],
  locks: [],
  accesses: [
    { id: "s1", laneId: "request", resourceId: "token_cache", kind: "write", line: 77, time: 0.28, locksHeld: [] },
    { id: "s2", laneId: "request", resourceId: "audit_buffer", kind: "write", line: 93, time: 0.62, locksHeld: [] },
    { id: "s3", laneId: "audit", resourceId: "token_cache", kind: "read", line: 152, time: 0.34, locksHeld: [] },
    { id: "s4", laneId: "audit", resourceId: "audit_buffer", kind: "read", line: 170, time: 0.70, locksHeld: [] },
  ],
  lockIntervals: [],
  races: [
    {
      aId: "s1",
      bId: "s3",
      resourceId: "token_cache",
      severity: "high",
      reason: "write/read across contexts, no synchronization",
    },
  ],
  lockOrder: [],
  deadlockCycles: [],
};

export const CONCURRENCY_MAPS: Record<string, ConcurrencyMap> = {
  "orchestrator.py": orchestrator,
  "routing_policy.py": routingPolicy,
  "security.py": security,
};

export function getConcurrencyMap(fileName: string): ConcurrencyMap | null {
  return CONCURRENCY_MAPS[fileName] ?? null;
}
