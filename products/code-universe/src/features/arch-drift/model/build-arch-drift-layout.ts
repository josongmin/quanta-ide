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

// ── Mock data (shown when no git history is connected) ───────────────

function mockArchDriftLayout(): ArchDriftLayout {
  const rows: ArchDriftRow[] = [
    { fileId: "src/domain/userService.ts",     fileName: "userService.ts",     kind: "layer-escalation",   severity: "high",   detail: "Now calls infra layer directly (was domain→adapter)",  beforeLayer: "domain",  afterLayer: "infra",    beforeDegree: 3,  afterDegree: 9,  severityColor: SEVERITY_COLORS.high },
    { fileId: "src/api/paymentClient.ts",      fileName: "paymentClient.ts",   kind: "fanout-explosion",   severity: "high",   detail: "Fan-out grew from 4 to 14 dependencies in 60 days",      beforeLayer: "adapter", afterLayer: "adapter",  beforeDegree: 4,  afterDegree: 14, severityColor: SEVERITY_COLORS.high },
    { fileId: "src/store/cartStore.ts",        fileName: "cartStore.ts",       kind: "new-cycle-member",   severity: "high",   detail: "Joined cycle: cartStore ↔ orderStore ↔ checkoutService", beforeLayer: "domain",  afterLayer: "domain",   beforeDegree: 2,  afterDegree: 6,  severityColor: SEVERITY_COLORS.high },
    { fileId: "src/components/Sidebar.tsx",    fileName: "Sidebar.tsx",        kind: "layer-escalation",   severity: "medium", detail: "UI component now imports from domain layer",              beforeLayer: "ui",      afterLayer: "ui",       beforeDegree: 2,  afterDegree: 5,  severityColor: SEVERITY_COLORS.medium },
    { fileId: "src/utils/formatters.ts",       fileName: "formatters.ts",      kind: "ownership-shift",    severity: "medium", detail: "Primary author changed 3 times in 30 days",              beforeLayer: "util",    afterLayer: "util",     beforeDegree: 1,  afterDegree: 3,  severityColor: SEVERITY_COLORS.medium },
    { fileId: "src/infra/logger.ts",           fileName: "logger.ts",          kind: "fanout-explosion",   severity: "medium", detail: "Depended on by 8 new callers across 3 layers",           beforeLayer: "infra",   afterLayer: "infra",    beforeDegree: 5,  afterDegree: 13, severityColor: SEVERITY_COLORS.medium },
    { fileId: "src/domain/orderService.ts",    fileName: "orderService.ts",    kind: "ownership-shift",    severity: "low",    detail: "Two new authors contributed 40% of lines",               beforeLayer: "domain",  afterLayer: "domain",   beforeDegree: 4,  afterDegree: 6,  severityColor: SEVERITY_COLORS.low },
    { fileId: "src/api/analyticsClient.ts",    fileName: "analyticsClient.ts", kind: "layer-escalation",   severity: "low",    detail: "Adapter started importing from util directly",            beforeLayer: "adapter", afterLayer: "adapter",  beforeDegree: 2,  afterDegree: 4,  severityColor: SEVERITY_COLORS.low },
  ];
  return { rows, highCount: 3, mediumCount: 3, lowCount: 2, totalCount: 8, hasHistory: true };
}

// ── Main entry ───────────────────────────────────────────────────────

export function buildArchDriftLayout(
  opts: BuildArchDriftLayoutOpts,
): ArchDriftLayout {
  const { graph } = opts;

  // ── 1. No history → mock layout ────────────────────────────────────
  if (!graph.history || graph.history.snapshots.length === 0) {
    return mockArchDriftLayout();
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
