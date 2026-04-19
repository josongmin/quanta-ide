import type { FileEdge, FileNode } from "./types";
import type { GraphHistory } from "./history";
import { materializeEdgeSet } from "./history";
import { findStronglyConnectedComponents } from "./scc";
import { detectArchViolations } from "./arch-violations";

// Smell genesis — locate the first snapshot where a specific smell began to
// apply to a file. A small number of smells are understood here; each maps
// to a cheap-to-evaluate predicate over a snapshot's rehydrated graph.
//
// Detection strategy per snapshot:
//   high-coupling    — rebuild degree counts for fileId, fail when degree
//                      meets or exceeds a threshold (default 15, inspired
//                      by SonarGraph's "coupling above average" signal).
//   cycle-member     — run Tarjan's SCC over the snapshot's edges and
//                      check membership of fileId.
//   risk-spike       — compare the current file's riskScore with its
//                      baseline (first snapshot) — require Δ >= 20 (matches
//                      CodeClimate's "significant risk" bucket).
//   layer-violation  — run the architecture detector; fail when any edge
//                      leaving the file lands in a forbidden layer.
//
// For risk-spike we rely on the caller providing baseline/current files
// (riskScore is not carried in the history's edge deltas). Layer violations
// rely on the current file catalogue too; we re-use the caller-supplied
// `currentGraph.files` for layer lookups across snapshots since layers
// change slowly compared to edges.

export type SmellKind =
  | "high-coupling"
  | "cycle-member"
  | "risk-spike"
  | "layer-violation";

export interface SmellGenesis {
  fileId: string;
  smell: SmellKind;
  firstSeenSha: string;
  firstSeenTimestamp: number;
}

export interface SmellDetectionOpts {
  /** Degree threshold for high-coupling. Default 15. */
  couplingThreshold?: number;
  /** Minimum risk delta for risk-spike detection. Default 20. */
  riskDeltaThreshold?: number;
}

const DEFAULT_COUPLING = 15;
const DEFAULT_RISK_DELTA = 20;

export function findSmellGenesis(
  fileId: string,
  smell: SmellKind,
  history: GraphHistory,
  currentGraph: { files: FileNode[]; fileEdges: FileEdge[] },
  opts: SmellDetectionOpts = {},
): SmellGenesis | null {
  if (history.snapshots.length === 0) return null;

  const edgeIndex = new Map<string, FileEdge>();
  for (const e of currentGraph.fileEdges) edgeIndex.set(e.id, e);

  const couplingThreshold = opts.couplingThreshold ?? DEFAULT_COUPLING;
  const riskDeltaThreshold = opts.riskDeltaThreshold ?? DEFAULT_RISK_DELTA;

  const targetFile = currentGraph.files.find(f => f.id === fileId);
  const baselineRisk = targetFile?.riskScore ?? 0;

  for (let i = 0; i < history.snapshots.length; i++) {
    const snap = history.snapshots[i];
    const edgeIds = materializeEdgeSet(history, i);
    const edges = edgesFromIds(edgeIds, edgeIndex);

    let present = false;
    switch (smell) {
      case "high-coupling":
        present = degreeOf(fileId, edges) >= couplingThreshold;
        break;
      case "cycle-member": {
        const scc = findStronglyConnectedComponents({ fileEdges: edges });
        present = scc.componentOf.has(fileId);
        break;
      }
      case "risk-spike":
        present = (targetFile?.riskScore ?? 0) - baselineRisk >= riskDeltaThreshold;
        break;
      case "layer-violation": {
        const violations = detectArchViolations({ files: currentGraph.files, fileEdges: edges });
        present = edges.some(e => e.from === fileId && violations.violatingEdgeIds.has(e.id));
        break;
      }
    }

    if (present) {
      if (!snap.commitSha) continue;
      return {
        fileId,
        smell,
        firstSeenSha: snap.commitSha,
        firstSeenTimestamp: snap.timestamp,
      };
    }
  }

  return null;
}

function edgesFromIds(ids: ReadonlySet<string>, idx: Map<string, FileEdge>): FileEdge[] {
  const out: FileEdge[] = [];
  for (const id of ids) {
    const e = idx.get(id);
    if (e) out.push(e);
  }
  return out;
}

function degreeOf(fileId: string, edges: readonly FileEdge[]): number {
  let d = 0;
  for (const e of edges) {
    if (e.from === fileId || e.to === fileId) d += 1;
  }
  return d;
}
