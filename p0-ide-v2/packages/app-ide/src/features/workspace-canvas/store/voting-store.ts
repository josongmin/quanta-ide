import { useSyncExternalStore } from "react";

// Dot-voting store (review.voting)
// ------------------------------------------------------------------
// Simple append-only list of (target, voter) pairs. A single voter can
// only vote once for a target — re-voting is a no-op; unvoting removes
// the entry. Counts are derived on demand.
//
// Targets are polymorphic: a file id, a sticky id, or (future) an
// annotation id. Keep the shape minimal — no score/weight — since dot
// voting intentionally treats every voter as equal.
//
// Persists to localStorage (key v1) so refresh preserves the tally;
// clearing is explicit via `reset()`.

export type VoteTargetKind = "file" | "sticky" | "annotation";

export interface Vote {
  targetKind: VoteTargetKind;
  targetId: string;
  voterId: string;
  createdAt: number;
}

export interface VoteTarget {
  kind: VoteTargetKind;
  id: string;
}

export interface VotingState {
  votes: readonly Vote[];
}

const STORAGE_KEY = "quanta.canvas.review.voting.v1";

function readPersisted(): VotingState | null {
  try {
    const raw = typeof localStorage === "undefined"
      ? null
      : localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.votes)) return null;
    const votes: Vote[] = [];
    for (const v of parsed.votes) {
      if (!v || typeof v !== "object") continue;
      if (typeof v.targetId !== "string") continue;
      if (v.targetKind !== "file" && v.targetKind !== "sticky" && v.targetKind !== "annotation") continue;
      if (typeof v.voterId !== "string") continue;
      if (typeof v.createdAt !== "number") continue;
      votes.push({
        targetKind: v.targetKind,
        targetId: v.targetId,
        voterId: v.voterId,
        createdAt: v.createdAt,
      });
    }
    return { votes };
  } catch {
    return null;
  }
}

function writePersisted(s: VotingState): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ votes: s.votes }));
  } catch {
    // best-effort
  }
}

let state: VotingState = readPersisted() ?? { votes: [] };
const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
  writePersisted(state);
}

function getState(): VotingState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function matches(v: Vote, target: VoteTarget): boolean {
  return v.targetKind === target.kind && v.targetId === target.id;
}

const actions = {
  vote(target: VoteTarget, voterId = "you"): void {
    const exists = state.votes.some(v => matches(v, target) && v.voterId === voterId);
    if (exists) return;
    const next: Vote = {
      targetKind: target.kind,
      targetId: target.id,
      voterId,
      createdAt: Date.now(),
    };
    state = { votes: [...state.votes, next] };
    emit();
  },

  unvote(target: VoteTarget, voterId = "you"): void {
    const next = state.votes.filter(v => !(matches(v, target) && v.voterId === voterId));
    if (next.length === state.votes.length) return;
    state = { votes: next };
    emit();
  },

  toggle(target: VoteTarget, voterId = "you"): void {
    const exists = state.votes.some(v => matches(v, target) && v.voterId === voterId);
    if (exists) actions.unvote(target, voterId);
    else actions.vote(target, voterId);
  },

  countFor(target: VoteTarget): number {
    let c = 0;
    for (const v of state.votes) if (matches(v, target)) c += 1;
    return c;
  },

  hasVoted(target: VoteTarget, voterId = "you"): boolean {
    return state.votes.some(v => matches(v, target) && v.voterId === voterId);
  },

  reset(): void {
    if (state.votes.length === 0) return;
    state = { votes: [] };
    emit();
  },
};

export const votingStore = { getState, subscribe, ...actions };

export function useVotingStore<T>(selector: (s: VotingState) => T): T {
  return useSyncExternalStore(
    votingStore.subscribe,
    () => selector(votingStore.getState()),
    () => selector(votingStore.getState()),
  );
}

/** Derived: top-N voted files. Pure function of state. */
export function topVotedFiles(
  state: VotingState,
  limit = 5,
): readonly { fileId: string; count: number }[] {
  const counts = new Map<string, number>();
  for (const v of state.votes) {
    if (v.targetKind !== "file") continue;
    counts.set(v.targetId, (counts.get(v.targetId) ?? 0) + 1);
  }
  return [...counts.entries()]
    .map(([fileId, count]) => ({ fileId, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, limit);
}
