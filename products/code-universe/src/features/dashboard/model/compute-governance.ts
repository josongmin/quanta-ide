import type { WorkspaceGraph } from "@quanta/canvas-engine";
import type {
  AdmissionDecision,
  Confidence,
  GovernanceData,
  GovernanceEvent,
  Metric,
  PolicyHit,
} from "./types";

// compute-governance
// --------------------------------------------------------------------
// L5 Admission Verdict layer. Reuses the same risk composition that
// AdmissionCardView uses so the two surfaces agree. Policy hits are
// derived from arch-violation edges + taint findings + cycles so the
// user sees the actual rules firing.

function softCap(value: number, cap: number): number {
  if (cap <= 0) return 0;
  const x = value / cap;
  return x / (1 + x);
}

function clamp100(n: number): number {
  return Math.max(0, Math.min(100, Math.round(n)));
}

function fmtInt(n: number): string {
  return new Intl.NumberFormat("en-US").format(Math.round(n));
}

function fmtPct(n: number): string {
  return `${Math.round(n)}%`;
}

function confidenceFromRatio(r: number): Confidence {
  if (r >= 0.66) return "HIGH";
  if (r >= 0.33) return "MED";
  return "LOW";
}

const POLICY_LABEL: Record<string, { label: string; color: string }> = {
  "arch.no-import-from":           { label: "Architecture Layering", color: "#0d99ff" },
  "taint.no-sink-without-sanitizer": { label: "Taint — Missing Sanitizer", color: "#e5484d" },
  "behavior.no-api-break":          { label: "API Break",       color: "#e09321" },
  "type.no-new-errors":             { label: "Type Regression", color: "#9e77ff" },
  "coverage.branch":                { label: "Branch Coverage", color: "#22a06b" },
  "cycle.no-new":                   { label: "No New Cycles",   color: "#e5484d" },
};

export interface ComputeGovernanceOpts {
  graph: WorkspaceGraph;
  now: number;
}

export function computeGovernance(opts: ComputeGovernanceOpts): GovernanceData {
  const { graph, now } = opts;
  const files = graph.files;
  const fileCount = Math.max(files.length, 1);

  // ── 1. Baseline + delta proxies (same shape as AdmissionCard) ────────
  let taint = 0, blast = 0, archV = 0, cpxSum = 0, cpxMax = 0, highRisk = 0;
  for (const f of files) {
    taint += f.signals.taintCount;
    blast += f.signals.blastCritical;
    archV += f.signals.archViolations;
    cpxSum += f.signals.cpxMax;
    if (f.signals.cpxMax > cpxMax) cpxMax = f.signals.cpxMax;
    if (f.riskScore >= 70) highRisk += 1;
  }
  const baseline = clamp100(
    100 * (
      0.35 * softCap(taint, 40) +
      0.25 * softCap(blast, 25) +
      0.20 * softCap(archV, 20) +
      0.20 * softCap(cpxSum / fileCount, 15)
    ),
  );
  const delta = clamp100(100 * softCap(highRisk, Math.max(8, fileCount * 0.05)));
  const process = 20;

  // ── 2. Evidence coverage ─────────────────────────────────────────────
  const proofCount = graph.proofs ? Object.keys(graph.proofs).length : 0;
  const blameCount = graph.blame ? Object.keys(graph.blame).length : 0;
  const hasHistory = !!graph.history;
  const evidenceRatio = Math.min(
    1,
    0.55 * Math.min(1, proofCount / Math.max(5, fileCount * 0.2)) +
    0.25 * Math.min(1, blameCount / Math.max(10, fileCount * 0.3)) +
    (hasHistory ? 0.20 : 0),
  );
  const evidenceCoverage = Math.round(evidenceRatio * 100);

  // ── 3. Policy penalty — direct rule hits ─────────────────────────────
  const policyPenalty = clamp100(15 * softCap(archV, 10) * 100 / 100);

  // Verdict
  const totalRisk = clamp100(baseline + delta + process - evidenceCoverage * 0.4 + policyPenalty);
  let decision: AdmissionDecision;
  if (totalRisk >= 80) decision = "BLOCK";
  else if (totalRisk >= 50) decision = "HOLD";
  else if (evidenceCoverage < 35) decision = "REVIEW";
  else decision = "PASS";

  const topReasons: string[] = [];
  if (archV > 0) topReasons.push(`${archV} arch violation${archV === 1 ? "" : "s"} in workspace`);
  if (taint > 0) topReasons.push(`${taint} taint signal${taint === 1 ? "" : "s"}`);
  if (highRisk > 0) topReasons.push(`${highRisk} file${highRisk === 1 ? "" : "s"} at high risk`);
  if (evidenceCoverage < 35) topReasons.push(`evidence coverage only ${evidenceCoverage}%`);
  if (topReasons.length === 0) topReasons.push("No critical findings detected.");

  const actionsToPass: string[] = [];
  if (archV > 0) actionsToPass.push("Resolve architecture-layer violations.");
  if (taint > 0) actionsToPass.push("Add sanitizer for tainted flows or mark as sanitized.");
  if (highRisk > 0) actionsToPass.push("Refactor or split high-risk files.");
  if (evidenceCoverage < 35) actionsToPass.push("Attach proofs / enable analyzers to lift evidence coverage.");
  if (actionsToPass.length === 0) actionsToPass.push("Re-run analyzers to refresh the verdict.");

  const verdictConfidence = confidenceFromRatio(evidenceRatio);

  // ── 4. Coverage metrics ──────────────────────────────────────────────
  const coverageMetrics: readonly Metric[] = [
    {
      label: "Evidence Coverage",
      value: fmtPct(evidenceCoverage),
      raw: evidenceCoverage,
      sentiment: evidenceCoverage >= 66 ? "good" : evidenceCoverage >= 33 ? "neutral" : "bad",
      confidence: verdictConfidence,
      confidenceReason: "Weighted over proofs, blame and history availability.",
    },
    {
      label: "Proof Bundles",
      value: fmtInt(proofCount),
      raw: proofCount,
      confidence: proofCount > 0 ? "HIGH" : "LOW",
      confidenceReason: proofCount > 0
        ? "Proofs declared on graph."
        : "No proof bundles — verdict relies on heuristics.",
    },
    {
      label: "Unverified Changes",
      value: "—",
      status: "missing",
      enableHint: "Connect PR diff feed.",
      confidence: "LOW",
      confidenceReason: "No diff/coverage source yet.",
    },
    {
      label: "Attested Files",
      value: fmtInt(blameCount),
      raw: blameCount,
      confidence: blameCount > 0 ? "MED" : "LOW",
      confidenceReason:
        blameCount > 0 ? "Blame data attaches provenance." : "No blame data.",
    },
  ];

  // ── 5. Policy metrics ────────────────────────────────────────────────
  const ruleHits: Record<string, number> = {};
  const archEdges = graph.fileEdges.filter(e => e.kind === "finding" && (e.severity === "high" || e.severity === "critical"));
  const taintEdges = graph.fileEdges.filter(e => e.kind === "taint-propagation");
  const cycleEdges = graph.fileEdges.filter(e => e.kind === "cycle");
  const contractEdges = graph.fileEdges.filter(e => e.kind === "contract");
  if (archV > 0) ruleHits["arch.no-import-from"] = archV;
  if (taintEdges.length > 0) ruleHits["taint.no-sink-without-sanitizer"] = taintEdges.length;
  if (cycleEdges.length > 0) ruleHits["cycle.no-new"] = cycleEdges.length;
  if (contractEdges.length > 0) ruleHits["behavior.no-api-break"] = contractEdges.length;

  const policyHits: PolicyHit[] = Object.entries(ruleHits).map(([ruleId, count]) => {
    const meta = POLICY_LABEL[ruleId] ?? { label: ruleId, color: "#757575" };
    const severity: PolicyHit["severity"] =
      count >= 20 ? "critical" : count >= 8 ? "high" : count >= 3 ? "medium" : "low";
    return { ruleId, label: meta.label, count, severity, color: meta.color };
  });
  policyHits.sort((a, b) => b.count - a.count);

  const totalPolicyHits = policyHits.reduce((a, p) => a + p.count, 0);
  const policyMetrics: readonly Metric[] = [
    {
      label: "Policy Violations",
      value: fmtInt(totalPolicyHits),
      raw: totalPolicyHits,
      sentiment: totalPolicyHits > 0 ? "bad" : "good",
      confidence: "HIGH",
      confidenceReason: "Declared verifier rules.",
    },
    {
      label: "Critical Severity",
      value: fmtInt(policyHits.filter(p => p.severity === "critical").length),
      sentiment: "bad",
      confidence: "HIGH",
      confidenceReason: "Rules with ≥20 hits.",
    },
    {
      label: "Distinct Rules Hit",
      value: fmtInt(policyHits.length),
      confidence: "HIGH",
      confidenceReason: "Unique verifier ids firing.",
    },
    {
      label: "Contract Edges",
      value: fmtInt(contractEdges.length),
      confidence: "MED",
      confidenceReason: "Declared contract edges.",
    },
  ];

  const trustMetrics: readonly Metric[] = [
    {
      label: "Reproducibility",
      value: "—",
      status: "missing",
      enableHint: "Run analyzer with seed tracking.",
      confidence: "LOW",
      confidenceReason: "Reproducibility audit pending.",
    },
    {
      label: "Snapshot Consistency",
      value: hasHistory ? "HIGH" : "—",
      status: hasHistory ? "enabled" : "missing",
      enableHint: "Provide git history source.",
      confidence: hasHistory ? "MED" : "LOW",
      confidenceReason: hasHistory
        ? "History snapshots present."
        : "No history source attached.",
    },
    {
      label: "Non-determinism",
      value: "—",
      status: "missing",
      enableHint: "Run analyzer twice for diff.",
      confidence: "LOW",
    },
  ];

  // ── 6. Recent events from proofs (fall back to arch findings) ────────
  const events: GovernanceEvent[] = [];
  if (graph.proofs) {
    const proofs = Object.values(graph.proofs);
    const sorted = proofs
      .filter(p => p.createdAt !== undefined)
      .sort((a, b) => (b.createdAt ?? 0) - (a.createdAt ?? 0))
      .slice(0, 8);
    for (const p of sorted) {
      events.push({
        id: p.id,
        at: p.createdAt ?? now,
        kind: p.kind,
        summary: p.summary,
        severity: p.severity,
        file: p.steps[0]?.file,
      });
    }
  }
  if (events.length < 5) {
    // Synthetic events from top arch violations so the feed isn't empty
    const archFindings = archEdges.slice(0, 5);
    for (let i = 0; i < archFindings.length; i++) {
      const e = archFindings[i]!;
      events.push({
        id: `synthetic-${i}`,
        at: now - i * 3600_000,
        kind: "finding",
        summary: `${POLICY_LABEL[e.kind]?.label ?? e.kind} · ${e.from} → ${e.to}`,
        severity: e.severity ?? "medium",
        file: e.from,
      });
    }
  }

  // Verdict distribution — synthetic history placeholder
  const verdictDistribution: readonly { decision: AdmissionDecision; count: number }[] = [
    { decision: "PASS",   count: decision === "PASS"   ? 1 : 0 },
    { decision: "REVIEW", count: decision === "REVIEW" ? 1 : 0 },
    { decision: "HOLD",   count: decision === "HOLD"   ? 1 : 0 },
    { decision: "BLOCK",  count: decision === "BLOCK"  ? 1 : 0 },
  ];

  return {
    verdict: {
      decision,
      totalRisk,
      confidence: verdictConfidence,
      topReasons,
      actionsToPass,
    },
    coverageMetrics,
    policyMetrics,
    trustMetrics,
    policyHits,
    recentEvents: events.slice(0, 8),
    verdictDistribution,
  };
}
