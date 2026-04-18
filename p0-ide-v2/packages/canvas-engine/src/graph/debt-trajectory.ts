import type { FileEdge, FileNode } from "./types";
import type { GraphHistory } from "./history";
import { materializeEdgeSet } from "./history";
import { findStronglyConnectedComponents } from "./scc";
import { detectArchViolations } from "./arch-violations";

// Debt trajectory — a timeseries view of "how bad is the codebase" over the
// recorded history, suitable for charting.
//
// Per snapshot we compute three debt signals that are cheap to re-derive:
//   - sccCount          — number of non-trivial cycles (Tarjan)
//   - archViolationCount — # edges that violate Clean/Hexagonal layering
//   - avgCpx            — mean complexity across current files (static —
//                          history doesn't carry LOC/cpx; we reuse the
//                          baseline file metadata so the timeline shows a
//                          stable reference)
//   - edgeCount / fileCount — raw graph shape as context
//
// The output timeseries is ordered oldest-to-newest; UI consumers (the
// `DebtTrajectoryChart`) hand-draw a polyline over the resulting array.

export interface DebtSnapshot {
  sha: string;
  timestamp: number;
  sccCount: number;
  archViolationCount: number;
  avgCpx?: number;
  edgeCount: number;
  fileCount: number;
}

export function computeDebtTrajectory(
  history: GraphHistory,
  baselineGraph: { files: FileNode[]; fileEdges: FileEdge[] },
): readonly DebtSnapshot[] {
  if (history.snapshots.length === 0) return [];

  const edgeIndex = new Map<string, FileEdge>();
  for (const e of baselineGraph.fileEdges) edgeIndex.set(e.id, e);

  // Avg cpx is computed once from the baseline catalogue — we don't have a
  // per-commit file list and recomputing this across every snapshot would
  // be wrong (unchanged cpx across commits would imply spurious stability
  // when that signal simply isn't recorded).
  const avgCpx = meanComplexity(baselineGraph.files);

  const out: DebtSnapshot[] = [];
  for (let i = 0; i < history.snapshots.length; i++) {
    const snap = history.snapshots[i];
    const edgeIds = materializeEdgeSet(history, i);
    const edges = edgesFromIds(edgeIds, edgeIndex);

    const scc = findStronglyConnectedComponents({ fileEdges: edges });
    const violations = detectArchViolations({ files: baselineGraph.files, fileEdges: edges });

    out.push({
      sha: snap.commitSha ?? `idx:${i}`,
      timestamp: snap.timestamp,
      sccCount: scc.components.length,
      archViolationCount: violations.violatingEdgeIds.size,
      avgCpx,
      edgeCount: edges.length,
      fileCount: baselineGraph.files.length,
    });
  }

  return out;
}

function edgesFromIds(ids: ReadonlySet<string>, idx: Map<string, FileEdge>): FileEdge[] {
  const out: FileEdge[] = [];
  for (const id of ids) {
    const e = idx.get(id);
    if (e) out.push(e);
  }
  return out;
}

function meanComplexity(files: readonly FileNode[]): number | undefined {
  if (files.length === 0) return undefined;
  let total = 0;
  let samples = 0;
  for (const f of files) {
    if (f.functions.length === 0) {
      total += f.signals.cpxMax;
      samples += 1;
      continue;
    }
    for (const fn of f.functions) {
      total += fn.complexity;
      samples += 1;
    }
  }
  if (samples === 0) return undefined;
  return total / samples;
}
