import type { FileEdge, FileNode } from "./types";
import type { GraphHistory } from "./history";
import { materializeEdgeSet } from "./history";

// Symbol-first-appearance — locate the earliest snapshot where a given
// symbol (function name, class name, or file path fragment) is reachable
// in the graph. Complements `findSmellGenesis` / `findCycleGenesis` as
// the third archaeology primitive.
//
// Query semantics:
//   * Case-insensitive substring match across file ids AND the `name`
//     of each file's declared functions.
//   * A file "appears" at a snapshot when the materialized edge set at
//     that snapshot contains at least one edge incident on the file.
//     This is the same reachability heuristic `cycle-archaeology` uses,
//     and stays consistent with the history's edge-delta granularity.
//   * Multiple matching files are collapsed into distinct results so a
//     caller searching a popular name (e.g. "handle") sees every hit.
//
// Returns results sorted by first-seen timestamp ASC so the oldest
// introduction surfaces first — that's the "genesis" the UI renders.

export interface SymbolMatch {
  /** File id whose symbols matched the query. */
  fileId: string;
  /** Matched symbol — either the file name or a function inside it. */
  matchedName: string;
  /** `"file"` when matched against the file id, `"function"` against a
   *  function declared inside the file. */
  kind: "file" | "function";
  /** First snapshot index where the file became reachable. */
  firstSnapshotIndex: number;
  /** Commit sha at that snapshot, when populated. */
  firstCommitSha: string | null;
  /** Timestamp at that snapshot. */
  firstTimestamp: number;
  /** Human label for the snapshot — `message` if present, otherwise `label`. */
  firstSnapshotLabel: string;
}

export interface SymbolSearchOpts {
  /** Maximum results to return. Default 20. */
  limit?: number;
  /** When true, only match against file ids (skip function names). */
  filesOnly?: boolean;
}

export function findSymbolFirstAppearance(
  rawQuery: string,
  history: GraphHistory,
  currentGraph: { files: readonly FileNode[]; fileEdges: readonly FileEdge[] },
  opts: SymbolSearchOpts = {},
): readonly SymbolMatch[] {
  const query = rawQuery.trim().toLowerCase();
  if (query.length < 2) return [];
  if (history.snapshots.length === 0) return [];

  const limit = Math.max(1, opts.limit ?? 20);
  const filesOnly = opts.filesOnly ?? false;

  // Collect candidate (fileId, matchedName, kind) triples from the
  // current graph. We don't try to reconstruct the historical file
  // manifest — assuming a file existed at or after its first
  // edge-incident snapshot is sufficient for the "first appearance" UX.
  interface Candidate {
    fileId: string;
    matchedName: string;
    kind: "file" | "function";
  }
  const candidates: Candidate[] = [];
  for (const f of currentGraph.files) {
    const idLower = f.id.toLowerCase();
    if (idLower.includes(query)) {
      candidates.push({ fileId: f.id, matchedName: f.name, kind: "file" });
    }
    if (filesOnly) continue;
    for (const fn of f.functions) {
      if (fn.name.toLowerCase().includes(query)) {
        candidates.push({ fileId: f.id, matchedName: fn.name, kind: "function" });
      }
    }
  }
  if (candidates.length === 0) return [];

  // Walk snapshots from oldest to newest, materializing edge sets only
  // once per snapshot. At each step we collect the set of file ids
  // reachable via any incident edge; the first snapshot a candidate
  // file is reachable in is its "first appearance".
  const edgeIndex = new Map<string, FileEdge>();
  for (const e of currentGraph.fileEdges) edgeIndex.set(e.id, e);

  const firstSeen = new Map<string, { snapshotIndex: number; timestamp: number; sha: string | null; label: string }>();
  const remaining = new Set(candidates.map(c => c.fileId));

  for (let i = 0; i < history.snapshots.length && remaining.size > 0; i++) {
    const snap = history.snapshots[i];
    const edgeIds = materializeEdgeSet(history, i);
    const reachable = new Set<string>();
    for (const eid of edgeIds) {
      const edge = edgeIndex.get(eid);
      if (!edge) continue;
      reachable.add(edge.from);
      reachable.add(edge.to);
    }
    for (const fileId of reachable) {
      if (!remaining.has(fileId)) continue;
      firstSeen.set(fileId, {
        snapshotIndex: i,
        timestamp: snap.timestamp,
        sha: snap.commitSha ?? null,
        label: snap.message ?? snap.label,
      });
      remaining.delete(fileId);
    }
  }

  const out: SymbolMatch[] = [];
  for (const c of candidates) {
    const first = firstSeen.get(c.fileId);
    if (!first) continue;
    out.push({
      fileId: c.fileId,
      matchedName: c.matchedName,
      kind: c.kind,
      firstSnapshotIndex: first.snapshotIndex,
      firstCommitSha: first.sha,
      firstTimestamp: first.timestamp,
      firstSnapshotLabel: first.label,
    });
  }

  // Sort by (timestamp ASC, fileId ASC, matchedName ASC) for a stable
  // deterministic ordering.
  out.sort((a, b) => {
    if (a.firstTimestamp !== b.firstTimestamp) return a.firstTimestamp - b.firstTimestamp;
    if (a.fileId !== b.fileId) return a.fileId < b.fileId ? -1 : 1;
    return a.matchedName < b.matchedName ? -1 : a.matchedName > b.matchedName ? 1 : 0;
  });

  return out.slice(0, limit);
}
