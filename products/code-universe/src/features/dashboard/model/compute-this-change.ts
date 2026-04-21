import {
  computeBlastCone,
  type WorkspaceGraph,
} from "@quanta/canvas-engine";
import type {
  BlastRing,
  ChangeScope,
  Metric,
  ThisChangeData,
} from "./types";

// compute-this-change
// --------------------------------------------------------------------
// L3 Delta Risk — for the currently-selected file/folder. If nothing is
// selected, returns an "empty scope" dataset the tab can render as
// "select a file to see blast radius".

function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

function riskBucketOf(score: number): "low" | "medium" | "high" {
  if (score < 30) return "low";
  if (score < 60) return "medium";
  return "high";
}

function softCap(value: number, cap: number): number {
  if (cap <= 0) return 0;
  const x = value / cap;
  return x / (1 + x);
}

export interface ComputeThisChangeOpts {
  graph: WorkspaceGraph;
  scope: ChangeScope;
}

export function computeThisChange(opts: ComputeThisChangeOpts): ThisChangeData {
  const { graph, scope } = opts;
  const hasSelection = scope.id !== null && scope.kind !== "repo";

  if (!hasSelection || scope.id === null) {
    return {
      scope,
      hasSelection: false,
      deltaRisk: { score: 0, bucket: "low", confidence: "LOW", category: "Speculative" },
      blastMetrics: [],
      rings: [],
      crossServiceEdges: [],
      callGraph: [],
      semanticDiff: [],
      contractBreak: [],
      processRisk: [],
    };
  }

  // ── Resolve to a concrete file if scope is a file/symbol ─────────────
  const selectedFile = graph.files.find(f => f.id === scope.id);
  // For folder scope we aggregate across files underneath.
  const folderFiles = scope.kind === "folder"
    ? graph.files.filter(f => f.id.startsWith(scope.path))
    : selectedFile
      ? [selectedFile]
      : [];

  // ── Blast — only meaningful for a single root file ───────────────────
  let rings: BlastRing[] = [];
  let totalAffected = 0;
  if (selectedFile) {
    try {
      const cone = computeBlastCone(graph, selectedFile.id, 5);
      rings = cone.rings.map(r => ({ depth: r.depth, count: r.fileIds.length }));
      totalAffected = cone.totalAffected;
    } catch {
      rings = [];
    }
  } else if (folderFiles.length > 0) {
    // Rough proxy: union of first-ring blasts for up to 12 files.
    const seen = new Set<string>();
    let depthOne = 0;
    for (const f of folderFiles.slice(0, 12)) {
      try {
        const cone = computeBlastCone(graph, f.id, 1);
        const first = cone.rings[0];
        if (first) {
          for (const id of first.fileIds) {
            if (!seen.has(id)) { seen.add(id); depthOne += 1; }
          }
        }
      } catch { /* ignore */ }
    }
    rings = depthOne > 0 ? [{ depth: 1, count: depthOne }] : [];
    totalAffected = depthOne;
  }

  // ── Cross-service edges touching scope ───────────────────────────────
  const targetIds = new Set(folderFiles.map(f => f.id));
  const crossServiceEdges = graph.fileEdges
    .filter(e => e.crossGraph && (targetIds.has(e.from) || targetIds.has(e.to)))
    .slice(0, 12)
    .map(e => ({ from: e.from, to: e.to, kind: e.kind }));

  // ── Affected symbols count (if symbol graph exists) ──────────────────
  const symbolsInScope = graph.symbolNodes?.filter(s => targetIds.has(s.fileId)).length ?? 0;
  const symbolEdgesInScope = graph.symbolEdges?.filter(
    e => targetIds.has(e.from.split("::")[0] ?? "") || targetIds.has(e.to.split("::")[0] ?? ""),
  ).length ?? 0;

  // ── Call-graph depth (longest blast ring depth) ──────────────────────
  const callDepth = rings.reduce((m, r) => Math.max(m, r.depth), 0);

  // ── Aggregate scope-level signals ────────────────────────────────────
  let taint = 0, blast = 0, archV = 0;
  for (const f of folderFiles) {
    taint += f.signals.taintCount;
    blast += f.signals.blastCritical;
    archV += f.signals.archViolations;
  }

  // ── Delta risk composite ─────────────────────────────────────────────
  const affectRatio = softCap(totalAffected, Math.max(10, graph.files.length * 0.05));
  const crossRatio = softCap(crossServiceEdges.length, 8);
  const taintR = softCap(taint, 8);
  const blastR = softCap(blast, 6);
  const archR = softCap(archV, 4);
  const deltaScore = Math.round(
    100 * (0.32 * affectRatio + 0.22 * blastR + 0.16 * crossRatio + 0.16 * taintR + 0.14 * archR),
  );
  const deltaBucket = riskBucketOf(deltaScore);
  const category: ThisChangeData["deltaRisk"]["category"] =
    deltaScore >= 60
      ? "Proven"
      : deltaScore >= 30
        ? "High-confidence"
        : "Speculative";

  const blastMetrics: readonly Metric[] = [
    {
      label: "Blast Radius",
      value: fmtInt(totalAffected),
      raw: totalAffected,
      sentiment: totalAffected > 20 ? "bad" : totalAffected > 5 ? "neutral" : "good",
      confidence: selectedFile ? "HIGH" : folderFiles.length > 0 ? "MED" : "LOW",
      confidenceReason: selectedFile
        ? `BFS over reverse-dependency edges up to depth 5.`
        : folderFiles.length > 0
          ? "Aggregate of first-ring blasts across folder."
          : "No scope selected.",
      hint: totalAffected > 0 ? `${rings.length} rings` : undefined,
    },
    {
      label: "Affected Files",
      value: fmtInt(folderFiles.length),
      raw: folderFiles.length,
      confidence: "HIGH",
      confidenceReason: "Counted from scope path.",
    },
    {
      label: "Affected Symbols",
      value: symbolsInScope > 0 ? fmtInt(symbolsInScope) : "—",
      raw: symbolsInScope,
      status: symbolsInScope > 0 ? "enabled" : "missing",
      enableHint: "Run the symbol-tier analyzer.",
      confidence: symbolsInScope > 0 ? "HIGH" : "LOW",
      confidenceReason:
        symbolsInScope > 0
          ? `Symbols declared in scope path.`
          : "No symbol nodes attached.",
    },
    {
      label: "Cross-Service Edges",
      value: fmtInt(crossServiceEdges.length),
      raw: crossServiceEdges.length,
      sentiment: crossServiceEdges.length > 0 ? "bad" : "good",
      confidence: "HIGH",
      confidenceReason: "Edges marked crossGraph intersecting scope.",
    },
  ];

  const callGraph: readonly Metric[] = [
    {
      label: "Call Depth",
      value: fmtInt(callDepth),
      raw: callDepth,
      confidence: selectedFile ? "HIGH" : "MED",
      confidenceReason: "Deepest reached ring in blast BFS.",
    },
    {
      label: "Symbol Edges Touched",
      value: symbolEdgesInScope > 0 ? fmtInt(symbolEdgesInScope) : "—",
      status: symbolEdgesInScope > 0 ? "enabled" : "missing",
      enableHint: "Symbol-tier analysis not attached.",
      confidence: symbolEdgesInScope > 0 ? "MED" : "LOW",
      confidenceReason:
        symbolEdgesInScope > 0
          ? "Symbol edges touching scope."
          : "Symbol graph empty.",
    },
  ];

  const semanticDiff: readonly Metric[] = [
    {
      label: "Semantic Diff",
      value: "—",
      status: "missing",
      enableHint: "Diff engine not wired.",
      confidence: "LOW",
      confidenceReason: "No baseline↔HEAD semantic diff yet.",
    },
    {
      label: "API Surface Change",
      value: "—",
      status: "missing",
      enableHint: "Public-API tracker pending.",
      confidence: "LOW",
      confidenceReason: "No public-symbol snapshot.",
    },
    {
      label: "Historical Break Rate",
      value: "—",
      status: "missing",
      enableHint: "Connect CI test history.",
      confidence: "LOW",
      confidenceReason: "No CI feed connected.",
    },
  ];

  const contractBreak: readonly Metric[] = [
    {
      label: "Contract Edges",
      value: fmtInt(graph.fileEdges.filter(e => e.kind === "contract").length),
      confidence: "MED",
      confidenceReason: "Declared contract edges in graph.",
    },
    {
      label: "Findings in Scope",
      value: fmtInt(
        graph.fileEdges.filter(
          e => e.kind === "finding" && (targetIds.has(e.from) || targetIds.has(e.to)),
        ).length,
      ),
      sentiment: "bad",
      confidence: "MED",
      confidenceReason: "Analyzer-emitted findings intersecting scope.",
    },
  ];

  const processRisk: readonly Metric[] = [
    {
      label: "Compile",
      value: "—",
      status: "missing",
      enableHint: "Connect build telemetry.",
      confidence: "LOW",
    },
    {
      label: "Typecheck",
      value: "—",
      status: "missing",
      enableHint: "Connect TypeScript compiler feed.",
      confidence: "LOW",
    },
    {
      label: "Tests (targeted)",
      value: "—",
      status: "missing",
      enableHint: "Connect test runner.",
      confidence: "LOW",
    },
    {
      label: "Agent Retries",
      value: "—",
      status: "missing",
      enableHint: "Connect agent telemetry.",
      confidence: "LOW",
    },
  ];

  return {
    scope,
    hasSelection: true,
    deltaRisk: {
      score: deltaScore,
      bucket: deltaBucket,
      confidence: selectedFile ? (totalAffected > 0 ? "HIGH" : "MED") : "MED",
      category,
    },
    blastMetrics,
    rings,
    crossServiceEdges,
    callGraph,
    semanticDiff,
    contractBreak,
    processRisk,
  };
}
