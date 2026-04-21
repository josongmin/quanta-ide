import {
  materializeEdgeSet,
  detectDrift,
  findStronglyConnectedComponents,
} from "@quanta/canvas-engine";
import type { FileEdge } from "@quanta/canvas-engine";
import type {
  ArchDriftRow,
  ArchDriftLayout,
  BuildArchDriftLayoutOpts,
} from "./types";

// build-arch-drift-layout
// --------------------------------------------------------------------
// Pure algorithm: WorkspaceGraph → ArchDriftLayout.
//
// Steps:
//   1. Guard against missing history → return empty layout.
//   2. Reconstruct baseline edge set at snapshot index 0.
//   3. Build before/after DriftSnapshot values.
//   4. Call detectDrift and map findings to ArchDriftRow.
//
// Determinism: no Math.random(), no Date.now(). All ordering comes
// from detectDrift (severity descending, fileId stable for ties).

// ── Severity → color ─────────────────────────────────────────────────

const SEVERITY_COLORS: Record<ArchDriftRow["severity"], string> = {
  high:   "#ef4444",
  medium: "#f97316",
  low:    "#f59e0b",
};

// ── Main entry ───────────────────────────────────────────────────────

export function buildArchDriftLayout(
  opts: BuildArchDriftLayoutOpts,
): ArchDriftLayout {
  const { graph } = opts;

  // ── 1. No history → empty layout ────────────────────────────────────
  if (!graph.history || graph.history.snapshots.length === 0) {
    return {
      rows: [],
      highCount: 0,
      mediumCount: 0,
      lowCount: 0,
      totalCount: 0,
      hasHistory: false,
    };
  }

  const history = graph.history;
  const lastIdx = history.snapshots.length - 1;

  // ── 2. Reconstruct baseline (index 0) edge set ────────────────────
  const baseEdgeIds = materializeEdgeSet(history, 0);
  const beforeEdges: FileEdge[] = graph.fileEdges.filter(e =>
    baseEdgeIds.has(e.id),
  );

  // ── 3. Build DriftSnapshot values ────────────────────────────────
  //
  // "before" = snapshot at index 0: same file list, but only the edges
  //            that were active at that snapshot.
  // "after"  = current HEAD: all file edges + SCCs.
  //
  // Note: we pass graph.files for both snapshots because FileNode.layer
  // is the current classification. The drift detector compares degree
  // and incoming-layer patterns, not the node metadata itself, so using
  // the same file list is intentional and correct (it mirrors how
  // Structure101 / Lattix baselines work — freeze the dependency graph,
  // not the taxonomy).

  const afterSCCResult = findStronglyConnectedComponents({
    fileEdges: graph.fileEdges,
  });

  // Filter to non-trivial SCCs (size > 1) — singleton SCCs are
  // simply isolated nodes and not meaningful cycles.
  const afterSCCs = afterSCCResult.components.filter(c => c.length > 1);

  // materializeEdgeSet at the last snapshot gives us "HEAD" edges as
  // a set of IDs; filter graph.fileEdges to that set for the after
  // snapshot. If the graph has no delta history (only one snapshot at
  // index 0 which equals lastIdx) then beforeEdges === afterEdges and
  // detectDrift will correctly find no findings.
  const afterEdgeIds =
    lastIdx === 0
      ? baseEdgeIds
      : materializeEdgeSet(history, lastIdx);

  const afterEdges: FileEdge[] =
    lastIdx === 0
      ? beforeEdges
      : graph.fileEdges.filter(e => afterEdgeIds.has(e.id));

  const beforeSnapshot = {
    files: graph.files,
    fileEdges: beforeEdges,
  };

  const afterSnapshot = {
    files: graph.files,
    fileEdges: afterEdges,
    sccs: afterSCCs as readonly (readonly string[])[],
  };

  // ── 4. Detect drift ──────────────────────────────────────────────
  const findings = detectDrift(beforeSnapshot, afterSnapshot);

  // ── 5. Build a quick name lookup ─────────────────────────────────
  const nameOf = new Map<string, string>();
  for (const f of graph.files) {
    nameOf.set(f.id, f.name);
  }

  // ── 6. Map to rows ───────────────────────────────────────────────
  const rows: ArchDriftRow[] = findings.map(f => ({
    fileId:        f.fileId,
    fileName:      nameOf.get(f.fileId) ?? f.fileId,
    kind:          f.kind,
    severity:      f.severity,
    detail:        f.detail,
    beforeLayer:   f.before.layer,
    afterLayer:    f.after.layer,
    beforeDegree:  f.before.degree,
    afterDegree:   f.after.degree,
    severityColor: SEVERITY_COLORS[f.severity],
  }));

  // ── 7. Aggregate counts ──────────────────────────────────────────
  let highCount = 0;
  let mediumCount = 0;
  let lowCount = 0;
  for (const r of rows) {
    if (r.severity === "high")   highCount++;
    else if (r.severity === "medium") mediumCount++;
    else lowCount++;
  }

  return {
    rows,
    highCount,
    mediumCount,
    lowCount,
    totalCount: rows.length,
    hasHistory: true,
  };
}
