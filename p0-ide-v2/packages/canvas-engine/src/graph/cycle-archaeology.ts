import type { EdgeKind, FileEdge } from "./types";
import type { GraphHistory } from "./history";
import { materializeEdgeSet } from "./history";

// Cycle archaeology — given a currently-present SCC, walk history backward
// to find the commit where the cycle first formed.
//
// Algorithm overview:
//   1. For each snapshot (0..N-1), materialise its edge set via the existing
//      `materializeEdgeSet` helper and check whether the SCC members are
//      strongly-connected within that snapshot's subgraph.
//   2. Binary-search is tempting but the predicate ("SCC formed?") is not
//      strictly monotonic — a cycle can form and break repeatedly across
//      refactors. We walk linearly from oldest to newest and report the
//      first snapshot where the SCC exists in full; that matches the
//      user-facing question ("when did this cycle first exist?").
//   3. Once the pivot snapshot is found we identify the closing edge by
//      comparing the pivot's edge set with the prior snapshot: any edge
//      added in the pivot delta that lies on a path inside the SCC is a
//      candidate; we pick the first matching one.
//
// Performance: full edge materialisation is cheap (Set operations) and the
// SCC predicate runs in O(|SCC| * |edges_of_subgraph|) which is linear in
// the local neighbourhood. History walk is O(N_snapshots * local_work).

export interface CycleGenesis {
  sccMembers: readonly string[];
  /** SHA where the cycle first closed. null if present already at baseline. */
  formedAtSha: string | null;
  /** Timestamp of `formedAtSha` when recorded in history. */
  formedAtTimestamp?: number;
  /** Edge whose addition in `formedAtSha` closed the cycle. */
  introducingEdge?: { from: string; to: string; kind: EdgeKind };
  /** SCC members that were already mutually reachable immediately before formation. */
  beforeFormation: readonly string[];
}

const CYCLE_KINDS: ReadonlySet<EdgeKind> = new Set<EdgeKind>(["import", "call"]);

/**
 * Given an SCC discovered at the head snapshot and the project's history,
 * locate the snapshot where every member became mutually reachable for the
 * first time.
 *
 * `edgeIndex` maps edgeId → FileEdge for the full superset of edges across
 * all snapshots (the caller typically constructs this once from the graph's
 * cumulative edge pool).
 */
export function findCycleGenesis(
  scc: readonly string[],
  history: GraphHistory,
  edgeIndex: Map<string, FileEdge>,
): CycleGenesis {
  const uniqueMembers = Array.from(new Set(scc));
  const memberSet = new Set(uniqueMembers);

  // Degenerate case: <2 members → self-loop. The cycle is trivially the edge
  // (m → m) first appearing; we fall through to normal processing.
  if (history.snapshots.length === 0 || uniqueMembers.length === 0) {
    return { sccMembers: uniqueMembers, formedAtSha: null, beforeFormation: [] };
  }

  let previousEdgeSet: ReadonlySet<string> | null = null;

  for (let i = 0; i < history.snapshots.length; i++) {
    const edgeIds = materializeEdgeSet(history, i);
    if (isSccClosedAt(memberSet, edgeIds, edgeIndex)) {
      const snap = history.snapshots[i];
      // Closing edge discovery — edges added in this snapshot's delta whose
      // endpoints are both within the SCC. When more than one qualifies we
      // pick the deterministic first by id so results are stable across
      // runs with identical history.
      const introducingEdge = findClosingEdge(memberSet, previousEdgeSet, edgeIds, edgeIndex);
      const beforeFormation = previousEdgeSet
        ? membersAlreadyLinked(memberSet, previousEdgeSet, edgeIndex)
        : [];
      return {
        sccMembers: uniqueMembers,
        formedAtSha: snap.commitSha ?? null,
        formedAtTimestamp: snap.timestamp,
        introducingEdge,
        beforeFormation,
      };
    }
    previousEdgeSet = edgeIds;
  }

  // Never closed in the recorded history — treat as "pre-existing at baseline"
  // which is the best approximation we can make when the SCC is known to
  // exist at head but history didn't capture its formation.
  return {
    sccMembers: uniqueMembers,
    formedAtSha: null,
    beforeFormation: [],
  };
}

/**
 * An SCC is "closed" within an edge set if every member can reach every
 * other member using edges in the set (restricted to cycle-bearing kinds).
 * We Tarjan the member subgraph — O(|E| + |V|) with members as V.
 */
function isSccClosedAt(
  members: ReadonlySet<string>,
  edgeIds: ReadonlySet<string>,
  edgeIndex: Map<string, FileEdge>,
): boolean {
  if (members.size === 0) return false;
  // Build adjacency restricted to members.
  const adj = new Map<string, string[]>();
  for (const m of members) adj.set(m, []);
  for (const id of edgeIds) {
    const e = edgeIndex.get(id);
    if (!e) continue;
    if (!CYCLE_KINDS.has(e.kind)) continue;
    if (members.has(e.from) && members.has(e.to)) {
      adj.get(e.from)!.push(e.to);
    }
  }

  // For each member, BFS forward through member-subgraph edges; then all
  // other members must be reachable.
  const start = adj.keys().next().value as string;
  // Forward reachability from `start` covers every other member when a
  // closed SCC exists.
  const forward = bfs(start, adj);
  if (forward.size !== members.size) return false;

  // Reverse adjacency — everyone must reach `start` too.
  const radj = new Map<string, string[]>();
  for (const m of members) radj.set(m, []);
  for (const [from, list] of adj) {
    for (const to of list) radj.get(to)!.push(from);
  }
  const backward = bfs(start, radj);
  return backward.size === members.size;
}

function bfs(start: string, adj: Map<string, string[]>): Set<string> {
  const seen = new Set<string>([start]);
  const queue: string[] = [start];
  let head = 0;
  while (head < queue.length) {
    const v = queue[head++];
    const neigh = adj.get(v);
    if (!neigh) continue;
    for (const w of neigh) {
      if (!seen.has(w)) {
        seen.add(w);
        queue.push(w);
      }
    }
  }
  return seen;
}

/** Candidate "closing" edges — added in this snapshot and endpoints inside SCC. */
function findClosingEdge(
  members: ReadonlySet<string>,
  previous: ReadonlySet<string> | null,
  current: ReadonlySet<string>,
  edgeIndex: Map<string, FileEdge>,
): { from: string; to: string; kind: EdgeKind } | undefined {
  const candidates: FileEdge[] = [];
  for (const id of current) {
    if (previous && previous.has(id)) continue;
    const e = edgeIndex.get(id);
    if (!e) continue;
    if (!CYCLE_KINDS.has(e.kind)) continue;
    if (members.has(e.from) && members.has(e.to)) candidates.push(e);
  }
  if (candidates.length === 0) return undefined;
  // Stable first — sort by id so repeated runs yield identical results.
  candidates.sort((a, b) => (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
  const pick = candidates[0];
  return { from: pick.from, to: pick.to, kind: pick.kind };
}

function membersAlreadyLinked(
  members: ReadonlySet<string>,
  previous: ReadonlySet<string>,
  edgeIndex: Map<string, FileEdge>,
): string[] {
  // Report members that had any structural outgoing edge to another member
  // in the previous snapshot — a "who was already connected" hint.
  const linked = new Set<string>();
  for (const id of previous) {
    const e = edgeIndex.get(id);
    if (!e) continue;
    if (!CYCLE_KINDS.has(e.kind)) continue;
    if (members.has(e.from) && members.has(e.to)) {
      linked.add(e.from);
      linked.add(e.to);
    }
  }
  return [...linked].sort();
}
