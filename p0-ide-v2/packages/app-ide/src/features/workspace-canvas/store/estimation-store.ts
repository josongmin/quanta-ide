import { useSyncExternalStore } from "react";

// Estimation poker store (review.poker)
// ------------------------------------------------------------------
// Per-(file, voter) Fibonacci estimate. Latest vote wins for a given
// voter+file — the store keeps at most one entry per pair, with its
// own createdAt timestamp (easier to reason about than partial updates).
//
// The deck is a fixed Fibonacci subset plus "?" for "can't estimate".
// Keep these as strings-or-numbers so the UI can switch on type.

export const POKER_DECK: readonly PokerScore[] = [1, 2, 3, 5, 8, 13, "?"] as const;

export type PokerScore = 1 | 2 | 3 | 5 | 8 | 13 | "?";

export interface Estimate {
  fileId: string;
  score: PokerScore;
  voterId: string;
  createdAt: number;
}

export interface EstimationState {
  estimates: readonly Estimate[];
}

const STORAGE_KEY = "quanta.canvas.review.poker.v1";

function isPokerScore(v: unknown): v is PokerScore {
  if (v === "?") return true;
  return typeof v === "number" && (POKER_DECK as readonly unknown[]).includes(v);
}

function readPersisted(): EstimationState | null {
  try {
    const raw = typeof localStorage === "undefined"
      ? null
      : localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.estimates)) return null;
    const estimates: Estimate[] = [];
    for (const e of parsed.estimates) {
      if (!e || typeof e !== "object") continue;
      if (typeof e.fileId !== "string") continue;
      if (typeof e.voterId !== "string") continue;
      if (typeof e.createdAt !== "number") continue;
      if (!isPokerScore(e.score)) continue;
      estimates.push({
        fileId: e.fileId,
        score: e.score,
        voterId: e.voterId,
        createdAt: e.createdAt,
      });
    }
    return { estimates };
  } catch {
    return null;
  }
}

function writePersisted(s: EstimationState): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ estimates: s.estimates }));
  } catch {
    // best-effort
  }
}

let state: EstimationState = readPersisted() ?? { estimates: [] };
const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
  writePersisted(state);
}

function getState(): EstimationState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const actions = {
  estimate(fileId: string, score: PokerScore, voterId = "you"): void {
    const now = Date.now();
    const without = state.estimates.filter(e => !(e.fileId === fileId && e.voterId === voterId));
    const next: Estimate = { fileId, score, voterId, createdAt: now };
    state = { estimates: [...without, next] };
    emit();
  },

  clearEstimate(fileId: string, voterId = "you"): void {
    const next = state.estimates.filter(e => !(e.fileId === fileId && e.voterId === voterId));
    if (next.length === state.estimates.length) return;
    state = { estimates: next };
    emit();
  },

  estimatesFor(fileId: string): readonly Estimate[] {
    return state.estimates.filter(e => e.fileId === fileId);
  },

  reset(): void {
    if (state.estimates.length === 0) return;
    state = { estimates: [] };
    emit();
  },
};

export const estimationStore = { getState, subscribe, ...actions };

export function useEstimationStore<T>(selector: (s: EstimationState) => T): T {
  return useSyncExternalStore(
    estimationStore.subscribe,
    () => selector(estimationStore.getState()),
    () => selector(estimationStore.getState()),
  );
}

/** Convert a PokerScore to its numeric value for aggregation; "?" ⇒ null. */
export function scoreToNumber(score: PokerScore): number | null {
  return typeof score === "number" ? score : null;
}

export interface FileEstimateStats {
  fileId: string;
  count: number;
  median: number | null;
  mean: number | null;
  stddev: number | null;
  scores: readonly PokerScore[];
}

export function statsFor(state: EstimationState, fileId: string): FileEstimateStats {
  const estimates = state.estimates.filter(e => e.fileId === fileId);
  const nums: number[] = [];
  for (const e of estimates) {
    const n = scoreToNumber(e.score);
    if (n !== null) nums.push(n);
  }
  if (nums.length === 0) {
    return {
      fileId,
      count: estimates.length,
      median: null,
      mean: null,
      stddev: null,
      scores: estimates.map(e => e.score),
    };
  }
  const sorted = [...nums].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  const median = sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
  const mean = nums.reduce((a, b) => a + b, 0) / nums.length;
  const variance = nums.reduce((acc, n) => acc + (n - mean) ** 2, 0) / nums.length;
  const stddev = Math.sqrt(variance);
  return {
    fileId,
    count: estimates.length,
    median,
    mean,
    stddev,
    scores: estimates.map(e => e.score),
  };
}

export function allFileIdsWithEstimates(state: EstimationState): readonly string[] {
  const ids = new Set<string>();
  for (const e of state.estimates) ids.add(e.fileId);
  return [...ids];
}
