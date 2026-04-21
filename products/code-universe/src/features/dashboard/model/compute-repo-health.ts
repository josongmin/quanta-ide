import {
  computeDebtTrajectory,
  computeWorkspaceMetrics,
  detectArchViolations,
  findStronglyConnectedComponents,
  type WorkspaceGraph,
  type FileNode,
} from "@quanta/canvas-engine";
import type {
  Confidence,
  Metric,
  RepoHealthData,
  RiskBucket,
  SmellSlice,
  TopRiskFile,
} from "./types";

// compute-repo-health
// --------------------------------------------------------------------
// L2 Baseline Risk aggregation — purely derived from the WorkspaceGraph.
// All math is deterministic: same graph → same output. No clocks, no
// random samples (computeWorkspaceMetrics is seeded internally).

const SMELL_PALETTE: Record<string, { label: string; color: string }> = {
  "high-coupling":   { label: "High Coupling",   color: "#e09321" },
  "cycle-member":    { label: "Cycle Member",    color: "#e5484d" },
  "risk-spike":      { label: "Risk Spike",      color: "#9e77ff" },
  "layer-violation": { label: "Layer Violation", color: "#0d99ff" },
};

function softCap(value: number, cap: number): number {
  if (cap <= 0) return 0;
  const x = value / cap;
  return x / (1 + x);
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

function fmt1(n: number): string {
  return Number.isInteger(n) ? String(n) : n.toFixed(1);
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`;
}

function trendFromDelta(delta: number): "up" | "down" | "flat" {
  if (delta > 0) return "up";
  if (delta < 0) return "down";
  return "flat";
}

function riskBucketOf(score: number): "low" | "medium" | "high" {
  if (score < 30) return "low";
  if (score < 60) return "medium";
  return "high";
}

function meanOf(nums: readonly number[]): number {
  if (nums.length === 0) return 0;
  let s = 0;
  for (const n of nums) s += n;
  return s / nums.length;
}

function confidenceForCoverage(pct: number): Confidence {
  if (pct >= 0.66) return "HIGH";
  if (pct >= 0.33) return "MED";
  return "LOW";
}

export function computeRepoHealth(graph: WorkspaceGraph): RepoHealthData {
  const files = graph.files;
  const fileCount = Math.max(files.length, 1);

  // ── 1. Workspace-wide metrics ──────────────────────────────────────
  const metrics = computeWorkspaceMetrics(graph, { computeBetweenness: files.length <= 1200 });

  // ── 2. Aggregate signals ───────────────────────────────────────────
  let taintTotal = 0;
  let blastTotal = 0;
  let deadTotal = 0;
  let archViolationTotal = 0;
  let cpxSum = 0;
  let cpxMax = 0;
  let cpxFunctionCount = 0;
  const riskScores: number[] = [];
  for (const f of files) {
    taintTotal += f.signals.taintCount;
    blastTotal += f.signals.blastCritical;
    deadTotal += f.signals.deadCount;
    archViolationTotal += f.signals.archViolations;
    for (const fn of f.functions) {
      cpxSum += fn.complexity;
      cpxFunctionCount += 1;
      if (fn.complexity > cpxMax) cpxMax = fn.complexity;
    }
    riskScores.push(f.riskScore);
  }
  const avgComplexity = cpxFunctionCount > 0 ? cpxSum / cpxFunctionCount : 0;

  // ── 3. Cycles via SCC ──────────────────────────────────────────────
  const scc = findStronglyConnectedComponents(graph);
  const cycleCount = scc.components.length;
  const largestCycle = scc.components.reduce((m, c) => Math.max(m, c.length), 0);

  // ── 4. Arch violations (recompute for count — FileNode carries per-file) ──
  const arch = detectArchViolations(graph);
  const archEdgeCount = arch.violatingEdgeIds.size;

  // ── 5. Baseline risk composite (0..100) ────────────────────────────
  const taintRatio  = softCap(taintTotal, Math.max(8, fileCount * 0.12));
  const blastRatio  = softCap(blastTotal, Math.max(4, fileCount * 0.06));
  const archRatio   = softCap(archEdgeCount, Math.max(4, fileCount * 0.04));
  const cpxRatio    = softCap(avgComplexity, 12);
  const cycleRatio  = softCap(cycleCount, Math.max(2, fileCount * 0.02));
  const baseline = Math.round(
    100 *
      (0.24 * taintRatio +
        0.20 * blastRatio +
        0.18 * archRatio +
        0.20 * cpxRatio +
        0.18 * cycleRatio),
  );
  const baselineBucket = riskBucketOf(baseline);
  const baselineContributors = [
    { label: "Taint",           weight: 0.24 * taintRatio * 100 },
    { label: "Blast Critical",  weight: 0.20 * blastRatio * 100 },
    { label: "Arch Violation",  weight: 0.18 * archRatio  * 100 },
    { label: "Complexity",      weight: 0.20 * cpxRatio   * 100 },
    { label: "Cycles",          weight: 0.18 * cycleRatio * 100 },
  ].map(c => ({ label: c.label, weight: Math.round(c.weight) }))
   .sort((a, b) => b.weight - a.weight);

  // Confidence — driven by how much of the graph has signals attached.
  const filesWithSignal = files.filter(
    f => f.signals.taintCount > 0 || f.signals.blastCritical > 0 || f.signals.archViolations > 0,
  ).length;
  const filesWithFns = files.filter(f => f.functions.length > 0).length;
  const coverage = Math.min(
    1,
    (filesWithSignal + filesWithFns) / Math.max(1, fileCount * 2),
  );
  const baselineConfidence = confidenceForCoverage(coverage);

  // ── 6. Primary / structural / semantic / confidence metrics ────────
  const primaryMetrics: readonly Metric[] = [
    {
      label: "Files",
      value: fmtInt(metrics.fileCount),
      raw: metrics.fileCount,
      confidence: "HIGH",
      confidenceReason: "Directly counted from the workspace graph.",
    },
    {
      label: "Edges",
      value: fmtInt(metrics.edgeCount),
      raw: metrics.edgeCount,
      confidence: "HIGH",
      confidenceReason: "Directly counted from the workspace graph.",
      hint: `${fmt1(metrics.edgeCount / Math.max(1, metrics.fileCount))} per file`,
    },
    {
      label: "Avg Degree",
      value: fmt1(meanOf([...metrics.perFile.values()].map(m => m.degree))),
      confidence: "HIGH",
      confidenceReason: "Exact degree computation over all edges.",
    },
    {
      label: "Avg Complexity",
      value: fmt1(avgComplexity),
      sentiment: avgComplexity > 10 ? "bad" : avgComplexity > 5 ? "neutral" : "good",
      confidence: cpxFunctionCount > 0 ? "HIGH" : "LOW",
      confidenceReason:
        cpxFunctionCount > 0
          ? `Mean over ${fmtInt(cpxFunctionCount)} analyzed functions.`
          : "No per-function complexity data available yet.",
      hint: cpxFunctionCount > 0 ? `peak ${fmtInt(cpxMax)}` : undefined,
    },
  ];

  const structuralMetrics: readonly Metric[] = [
    {
      label: "Cycles",
      value: fmtInt(cycleCount),
      raw: cycleCount,
      sentiment: cycleCount > 0 ? "bad" : "good",
      confidence: "HIGH",
      confidenceReason: "Tarjan SCC over import + call edges.",
      hint: cycleCount > 0 ? `largest ${largestCycle} files` : "no cycles",
    },
    {
      label: "Arch Violations",
      value: fmtInt(archEdgeCount),
      raw: archEdgeCount,
      sentiment: archEdgeCount > 0 ? "bad" : "good",
      confidence: "HIGH",
      confidenceReason: "Layer rules over structural edges (Clean Architecture).",
    },
    {
      label: "Fan-in Hotspots",
      value: fmtInt(
        [...metrics.perFile.values()].filter(m => m.inDegree >= 10).length,
      ),
      sentiment: "neutral",
      confidence: "HIGH",
      confidenceReason: "Files with ≥10 incoming edges.",
    },
    {
      label: "Dead-code Edges",
      value: fmtInt(deadTotal),
      raw: deadTotal,
      sentiment: deadTotal > 0 ? "bad" : "good",
      confidence: "MED",
      confidenceReason: "Analyzer-declared dead edges; may miss runtime-only calls.",
    },
  ];

  const semanticMetrics: readonly Metric[] = [
    {
      label: "Taint Risk",
      value: fmtInt(taintTotal),
      raw: taintTotal,
      sentiment: taintTotal > 0 ? "bad" : "good",
      confidence: taintTotal > 0 ? "MED" : "LOW",
      confidenceReason:
        taintTotal > 0
          ? "Source → sink flows detected; sanitizer verification partial."
          : "No taint flows declared — analyzer may not be attached.",
    },
    {
      label: "Blast Critical",
      value: fmtInt(blastTotal),
      raw: blastTotal,
      sentiment: blastTotal > 0 ? "bad" : "good",
      confidence: "MED",
      confidenceReason: "Reverse-dependency closure with critical-severity cutoff.",
    },
    {
      label: "Side-effect Risk",
      value: graph.effects ? fmtInt(Object.keys(graph.effects).length) : "—",
      status: graph.effects ? "enabled" : "missing",
      enableHint: "Attach effects analyzer to populate.",
      sentiment: "neutral",
      confidence: graph.effects ? "MED" : "LOW",
      confidenceReason: graph.effects
        ? "File-scoped effect annotations."
        : "No alias / SSA analyzer wired.",
    },
    {
      label: "Logic Proof Gap",
      value: "—",
      status: "missing",
      enableHint: "SSA proof engine pending.",
      confidence: "LOW",
      confidenceReason: "Not yet implemented — L2-C gap.",
    },
  ];

  // Analysis confidence — self-report of how much we trust the graph.
  const symbolCount = graph.symbolNodes?.length ?? 0;
  const symbolEdgeCount = graph.symbolEdges?.length ?? 0;
  const symbolCoverage = symbolCount > 0 ? symbolEdgeCount / symbolCount : 0;
  const callResolutionPct = Math.min(100, Math.round(symbolCoverage * 60));
  const proofCount = graph.proofs ? Object.keys(graph.proofs).length : 0;
  const confidenceMetrics: readonly Metric[] = [
    {
      label: "Call-Graph Resolution",
      value: symbolCount > 0 ? fmtPct(callResolutionPct) : "—",
      status: symbolCount > 0 ? "enabled" : "missing",
      enableHint: "Run the symbol-tier analyzer.",
      confidence: symbolCount > 0 ? "MED" : "LOW",
      confidenceReason:
        symbolCount > 0
          ? `${fmtInt(symbolEdgeCount)} resolved over ${fmtInt(symbolCount)} symbols.`
          : "Symbol nodes not populated.",
    },
    {
      label: "Dynamic Fallback",
      value: "—",
      status: "missing",
      enableHint: "Analyzer telemetry not reported.",
      confidence: "LOW",
      confidenceReason: "Dynamic / reflection fallback stats unavailable.",
    },
    {
      label: "Unsupported Constructs",
      value: "—",
      status: "missing",
      enableHint: "Analyzer telemetry not reported.",
      confidence: "LOW",
      confidenceReason: "Analyzer does not yet emit coverage stats.",
    },
    {
      label: "Proof Bundles",
      value: fmtInt(proofCount),
      raw: proofCount,
      confidence: proofCount > 0 ? "HIGH" : "LOW",
      confidenceReason:
        proofCount > 0
          ? "Evidence attached to graph."
          : "No proof bundles attached — verdict relies on heuristics.",
    },
  ];

  // ── 7. Risk distribution ───────────────────────────────────────────
  const distribution: RiskBucket[] = [
    { bucket: "low",    count: 0 },
    { bucket: "medium", count: 0 },
    { bucket: "high",   count: 0 },
  ];
  for (const r of riskScores) {
    const b = riskBucketOf(r);
    const entry = distribution.find(d => d.bucket === b);
    if (entry) entry.count += 1;
  }

  // ── 8. Top risk files (sorted by riskScore) ────────────────────────
  const sortedByRisk: FileNode[] = [...files]
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 10);
  const topRiskFiles: readonly TopRiskFile[] = sortedByRisk.map(f => {
    const reasons: string[] = [];
    if (f.signals.archViolations > 0) reasons.push(`${f.signals.archViolations} arch`);
    if (f.signals.taintCount > 0) reasons.push(`${f.signals.taintCount} taint`);
    if (f.signals.blastCritical > 0) reasons.push(`${f.signals.blastCritical} blast`);
    if (f.signals.cpxMax >= 10) reasons.push(`cpx ${f.signals.cpxMax}`);
    if (scc.componentOf.has(f.id)) reasons.push("cycle");
    return {
      id: f.id,
      name: f.name,
      path: f.id,
      score: f.riskScore,
      loc: f.loc,
      layer: f.layer,
      reasons,
    };
  });

  // ── 9. Smell breakdown ─────────────────────────────────────────────
  // Per-smell approximations — live smell genesis would need history.
  const inCycleCount = scc.components.reduce((a, c) => a + c.length, 0);
  const highCouplingCount = [...metrics.perFile.values()].filter(m => m.degree >= 15).length;
  const layerViolationCount = files.filter(f => f.signals.archViolations > 0).length;
  const riskSpikeCount = files.filter(f => f.riskScore >= 70).length;
  const smellBreakdown: readonly SmellSlice[] = [
    { kind: "high-coupling",   label: SMELL_PALETTE["high-coupling"]!.label,   count: highCouplingCount,    color: SMELL_PALETTE["high-coupling"]!.color },
    { kind: "cycle-member",    label: SMELL_PALETTE["cycle-member"]!.label,    count: inCycleCount,          color: SMELL_PALETTE["cycle-member"]!.color },
    { kind: "layer-violation", label: SMELL_PALETTE["layer-violation"]!.label, count: layerViolationCount,  color: SMELL_PALETTE["layer-violation"]!.color },
    { kind: "risk-spike",      label: SMELL_PALETTE["risk-spike"]!.label,      count: riskSpikeCount,        color: SMELL_PALETTE["risk-spike"]!.color },
  ];

  // ── 10. Debt trend (sparkline) ─────────────────────────────────────
  const hasHistory = !!graph.history && graph.history.snapshots.length > 0;
  let debtSeries: RepoHealthData["debtSeries"] = [];
  if (hasHistory && graph.history) {
    const snapshots = computeDebtTrajectory(graph.history, graph);
    if (snapshots.length > 0) {
      const norm = (key: "sccCount" | "archViolationCount" | "avgCpx"): readonly number[] => {
        const raws = snapshots.map(s => (key === "avgCpx" ? s.avgCpx ?? 0 : s[key]));
        const mx = Math.max(1, ...raws);
        return raws.map(r => r / mx);
      };
      const last = snapshots[snapshots.length - 1]!;
      const first = snapshots[0]!;
      debtSeries = [
        { label: "Cycles",          points: norm("sccCount"),           latest: last.sccCount,          delta: last.sccCount - first.sccCount,                           color: "#e5484d" },
        { label: "Arch Violations", points: norm("archViolationCount"), latest: last.archViolationCount, delta: last.archViolationCount - first.archViolationCount,      color: "#e09321" },
        { label: "Avg Complexity",  points: norm("avgCpx"),              latest: last.avgCpx ?? 0,       delta: (last.avgCpx ?? 0) - (first.avgCpx ?? 0),                 color: "#9e77ff" },
      ];
    }
  }

  // Attach trends to the primary "Cycles" / "Arch Violations" cards
  // if we have a series — so sparklines render in-card.
  const structuralWithTrend: readonly Metric[] = structuralMetrics.map(m => {
    if (m.label === "Cycles" && debtSeries[0]) {
      return {
        ...m,
        sparkline: debtSeries[0].points,
        delta: debtSeries[0].delta,
        trend: trendFromDelta(debtSeries[0].delta),
      };
    }
    if (m.label === "Arch Violations" && debtSeries[1]) {
      return {
        ...m,
        sparkline: debtSeries[1].points,
        delta: debtSeries[1].delta,
        trend: trendFromDelta(debtSeries[1].delta),
      };
    }
    return m;
  });

  return {
    baselineRisk: {
      score: baseline,
      bucket: baselineBucket,
      confidence: baselineConfidence,
      topContributors: baselineContributors,
    },
    primaryMetrics,
    structuralMetrics: structuralWithTrend,
    semanticMetrics,
    confidenceMetrics,
    riskDistribution: distribution,
    topRiskFiles,
    smellBreakdown,
    debtSeries,
    hasHistory,
  };
}
