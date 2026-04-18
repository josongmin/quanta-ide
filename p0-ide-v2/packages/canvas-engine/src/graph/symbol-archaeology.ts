import type { FileEdge } from "./types";
import type { GraphHistory } from "./history";
import { materializeEdgeSet } from "./history";

// Symbol archaeology — answer "when did this symbol first appear in this
// file?" from the recorded edge history.
//
// Approximation: we don't have AST snapshots at every commit, only the edge
// set. We treat a symbol as "present" in a file once any edge whose
// fromSymbol or toSymbol matches that symbol is anchored at the file. This
// leans on the analyzer populating per-edge symbol metadata (which the
// sources we integrate do today for call / taint / import edges).
//
// The walk is oldest-to-newest; the first snapshot whose edge set contains
// a qualifying edge is the "first appearance". We return the snapshot's
// commit metadata when available.

export interface SymbolAppearance {
  symbol: string;
  fileId: string;
  firstSeenSha: string;
  firstSeenTimestamp: number;
  commitMessage?: string;
  author?: string;
}

export function findSymbolFirstAppearance(
  symbol: string,
  fileId: string,
  history: GraphHistory,
  edgeIndex: Map<string, FileEdge>,
): SymbolAppearance | null {
  if (!symbol || !fileId) return null;
  if (history.snapshots.length === 0) return null;

  for (let i = 0; i < history.snapshots.length; i++) {
    const snap = history.snapshots[i];
    const edgeIds = materializeEdgeSet(history, i);
    for (const id of edgeIds) {
      const e = edgeIndex.get(id);
      if (!e) continue;
      if (symbolMatchesEdgeAtFile(e, symbol, fileId)) {
        // Only return if the snapshot recorded a commit sha — callers use
        // that as the authoritative identity. Without a sha the appearance
        // point is too fuzzy to name usefully.
        if (!snap.commitSha) continue;
        return {
          symbol,
          fileId,
          firstSeenSha: snap.commitSha,
          firstSeenTimestamp: snap.timestamp,
          commitMessage: snap.label,
        };
      }
    }
  }

  return null;
}

function symbolMatchesEdgeAtFile(edge: FileEdge, symbol: string, fileId: string): boolean {
  if (edge.from === fileId && edge.fromSymbol === symbol) return true;
  if (edge.to === fileId && edge.toSymbol === symbol) return true;
  return false;
}
