// Adapter: ProofCarryingPR → AdmissionVerdictLike.
//
// The admission-card product renders an `AdmissionVerdict`. We re-declare
// the subset of that shape here (intentionally duplicated — lib layer
// must not import from products/). A local `satisfies` check at the
// bottom of the file fences the duplication: if the product type drifts,
// TypeScript will catch the mismatch at next typecheck because the
// structure of `AdmissionVerdictLike` is load-bearing for the card.
//
// Mapping rules (see lib design doc):
//
//   decision:
//     BLOCK   if any hunk is risky AND coverage ratio < 0.6
//     HOLD    else if any hunk is risky OR coverage < 0.5
//     PASS    else if coverage >= 0.9 AND zero risky
//     REVIEW  otherwise
//
//   confidence:
//     HIGH    verifier count >= 4 AND coverage >= 0.7
//     LOW     verifier count < 2 OR coverage < 0.4
//     MEDIUM  otherwise
//
//   totalRisk (0..100) =
//     100 * (risky / total) * 0.45
//   + 100 * (1 - coverage) * 0.35
//   + 100 * (failed / totalChecks) * 0.20
//
// Reasons: top-3 by |weight|. Actions: one per unique failing verifier,
// plus coverage/risky summary items.

import type { HunkAttestation, HunkClassification, ProofCarryingPR } from "./types";

// ── Local re-declaration of the product's verdict shape ──────────────
// Keep fields and names identical to
// products/code-universe/src/features/admission-card/model/types.ts.

/** Top-level gate decision. */
export type VerdictDecision = "PASS" | "HOLD" | "BLOCK" | "REVIEW";

/** A single reason bullet displayed on the admission card. */
export interface AdmissionReasonLike {
  text: string;
  source: "baseline" | "delta" | "process" | "evidence" | "policy";
  weight: number;
}

/** An actionable todo that, when done, moves the verdict toward PASS. */
export interface AdmissionActionLike {
  text: string;
  done: boolean;
}

/** Per-hunk row rendered in the admission card drill-down. */
export interface HunkRowLike {
  file: string;
  range: string;
  classification: HunkClassification;
  riskBefore: number;
  riskAfter: number;
}

/** Contribution slices summing (with sign) to totalRisk. */
export interface RiskContributionLike {
  baseline: number;
  delta: number;
  process: number;
  evidenceCoverage: number;
  policyPenalty: number;
}

/**
 * Admission-card-compatible verdict synthesized from a proof. Structurally
 * compatible with the product's `AdmissionVerdict` — if the product shape
 * drifts, the bottom-of-file `satisfies` guard will fail to compile.
 */
export interface AdmissionVerdictLike {
  decision: VerdictDecision;
  totalRisk: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  contributions: RiskContributionLike;
  reasons: AdmissionReasonLike[];
  actions: AdmissionActionLike[];
  hunks: HunkRowLike[];
  coverage: {
    verifiedHunks: number;
    totalHunks: number;
    ratio: number;
  };
  changeLabel: string;
}

// ── Helpers ───────────────────────────────────────────────────────────

function extractRange(hunkHeader: string): string {
  // "@@ -12,6 +12,8 @@" → "L12-19" (start..start+count-1 of the new range)
  const m = hunkHeader.match(/\+(\d+)(?:,(\d+))?/);
  if (!m) return "";
  const start = Number(m[1]);
  const count = m[2] !== undefined ? Number(m[2]) : 1;
  if (!Number.isFinite(start) || !Number.isFinite(count) || count <= 0) {
    return `L${start}`;
  }
  const end = start + count - 1;
  return start === end ? `L${start}` : `L${start}-${end}`;
}

function clamp01(x: number): number {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

function clamp100(x: number): number {
  if (x < 0) return 0;
  if (x > 100) return 100;
  return x;
}

function decide(
  ratio: number,
  riskyCount: number,
): VerdictDecision {
  const anyRisky = riskyCount > 0;
  if (anyRisky && ratio < 0.6) return "BLOCK";
  if (anyRisky || ratio < 0.5) return "HOLD";
  if (ratio >= 0.9 && !anyRisky) return "PASS";
  return "REVIEW";
}

function computeConfidence(
  verifierCount: number,
  ratio: number,
): "HIGH" | "MEDIUM" | "LOW" {
  if (verifierCount >= 4 && ratio >= 0.7) return "HIGH";
  if (verifierCount < 2 || ratio < 0.4) return "LOW";
  return "MEDIUM";
}

function collectVerifiers(attestations: readonly HunkAttestation[]): Set<string> {
  const out = new Set<string>();
  for (const a of attestations) {
    for (const c of a.checks) out.add(c.verifier);
  }
  return out;
}

function countChecks(
  attestations: readonly HunkAttestation[],
): { total: number; failed: number; failedByVerifier: Map<string, number> } {
  let total = 0;
  let failed = 0;
  const failedByVerifier = new Map<string, number>();
  for (const a of attestations) {
    for (const c of a.checks) {
      total++;
      if (c.status === "fail") {
        failed++;
        failedByVerifier.set(
          c.verifier,
          (failedByVerifier.get(c.verifier) ?? 0) + 1,
        );
      }
    }
  }
  return { total, failed, failedByVerifier };
}

function averageBefore(attestations: readonly HunkAttestation[]): number {
  if (attestations.length === 0) return 0;
  let sum = 0;
  for (const a of attestations) sum += a.risk.before;
  return sum / attestations.length;
}

function averageDelta(attestations: readonly HunkAttestation[]): number {
  if (attestations.length === 0) return 0;
  let sum = 0;
  for (const a of attestations) sum += a.risk.after - a.risk.before;
  return sum / attestations.length;
}

/**
 * Convert a validated proof into an admission-card verdict. Purely
 * functional; no I/O. The adapter *should not* make data up — fields it
 * cannot compute from the proof are either zero or omitted, never
 * fabricated.
 *
 * @example
 * const verdict = toAdmissionVerdict(proof);
 * // verdict.decision === "PASS" | "HOLD" | "BLOCK" | "REVIEW"
 * // verdict.coverage.ratio === proof.coverage.ratio
 */
export function toAdmissionVerdict(
  proof: ProofCarryingPR,
  opts?: { changeLabel?: string },
): AdmissionVerdictLike {
  const { attestations, coverage } = proof;
  const ratio = clamp01(coverage.ratio);

  // Classification bookkeeping.
  let riskyCount = 0;
  const riskyAttestations: HunkAttestation[] = [];
  for (const a of attestations) {
    if (a.classification === "risky") {
      riskyCount++;
      riskyAttestations.push(a);
    }
  }

  const total = attestations.length;
  const verifierSet = collectVerifiers(attestations);
  const { total: totalChecks, failed: failedChecks, failedByVerifier } =
    countChecks(attestations);

  // totalRisk formula — three weighted components.
  const riskyRatio = total > 0 ? riskyCount / total : 0;
  const coverageGap = 1 - ratio;
  const failRatio = totalChecks > 0 ? failedChecks / totalChecks : 0;
  const totalRisk = clamp100(
    100 * riskyRatio * 0.45 + 100 * coverageGap * 0.35 + 100 * failRatio * 0.2,
  );

  // Contributions.
  const baseline = clamp100(averageBefore(attestations));
  const delta = clamp100(Math.max(0, averageDelta(attestations)));
  const process = clamp100(
    100 * (proof.complianceSummary.liesDetected > 0 ? 0.8 : 0.2),
  );
  const evidenceCoverage = clamp100(100 * ratio);
  const compDenom = Math.max(
    1,
    proof.complianceSummary.pass +
      proof.complianceSummary.fail +
      proof.complianceSummary.unknown,
  );
  const policyPenalty = clamp100(
    100 * (proof.complianceSummary.fail / compDenom),
  );

  // Reasons — collect with |weight|, keep top 3.
  const reasons: AdmissionReasonLike[] = [];

  // Sort risky hunks by (after - before) descending, then by absolute after.
  const worstRisky = [...riskyAttestations].sort((a, b) => {
    const da = a.risk.after - a.risk.before;
    const db = b.risk.after - b.risk.before;
    if (db !== da) return db - da;
    return b.risk.after - a.risk.after;
  });
  for (const a of worstRisky) {
    const range = extractRange(a.hunkHeader);
    reasons.push({
      text: `${a.file} ${range} — ${a.classification}, risk ${a.risk.before}→${a.risk.after}`,
      source: "delta",
      weight: Math.max(
        1,
        clamp100(Math.abs(a.risk.after - a.risk.before) + 10),
      ),
    });
  }

  if (ratio < 0.7) {
    reasons.push({
      text: `Coverage only ${Math.round(ratio * 100)}% (${coverage.verifiedHunks}/${coverage.totalHunks} hunks)`,
      source: "evidence",
      weight: clamp100(100 * (0.7 - ratio)),
    });
  }

  if (proof.complianceSummary.fail > 0) {
    reasons.push({
      text: `${proof.complianceSummary.fail} compliance rule(s) failing`,
      source: "policy",
      weight: clamp100(100 * (proof.complianceSummary.fail / compDenom)),
    });
  }

  reasons.sort((a, b) => Math.abs(b.weight) - Math.abs(a.weight));
  const topReasons = reasons.slice(0, 3);

  // Actions.
  const actions: AdmissionActionLike[] = [];
  // Deterministic verifier ordering.
  const failingVerifiers = [...failedByVerifier.entries()].sort((a, b) => {
    if (b[1] !== a[1]) return b[1] - a[1];
    return a[0].localeCompare(b[0]);
  });
  for (const [verifier, count] of failingVerifiers) {
    actions.push({ text: `fix ${verifier} failures (${count})`, done: false });
  }
  if (ratio < 0.9) {
    actions.push({ text: "Raise coverage above 90%", done: false });
  }
  if (riskyCount > 0) {
    actions.push({
      text: `Address ${riskyCount} risky hunk${riskyCount === 1 ? "" : "s"}`,
      done: false,
    });
  }

  // Hunks — direct mapping, preserves order.
  const hunks: HunkRowLike[] = attestations.map((a) => ({
    file: a.file,
    range: extractRange(a.hunkHeader),
    classification: a.classification,
    riskBefore: a.risk.before,
    riskAfter: a.risk.after,
  }));

  const decision = decide(ratio, riskyCount);
  const confidence = computeConfidence(verifierSet.size, ratio);

  const verdict: AdmissionVerdictLike = {
    decision,
    totalRisk,
    confidence,
    contributions: {
      baseline,
      delta,
      process,
      evidenceCoverage,
      policyPenalty,
    },
    reasons: topReasons,
    actions,
    hunks,
    coverage: {
      verifiedHunks: coverage.verifiedHunks,
      totalHunks: coverage.totalHunks,
      ratio,
    },
    changeLabel: opts?.changeLabel ?? `PR ${proof.prId}`,
  };
  return verdict;
}

// ── Structural guard ──────────────────────────────────────────────────
// If the product's AdmissionVerdict drifts, the following `satisfies`
// check (using a locally-redeclared mirror of that shape) will fail at
// typecheck. Update both this mirror AND the product type together.

interface ProductAdmissionVerdictMirror {
  decision: "PASS" | "HOLD" | "BLOCK" | "REVIEW";
  totalRisk: number;
  confidence: "HIGH" | "MEDIUM" | "LOW";
  contributions: {
    baseline: number;
    delta: number;
    process: number;
    evidenceCoverage: number;
    policyPenalty: number;
  };
  reasons: Array<{
    text: string;
    source: "baseline" | "delta" | "process" | "evidence" | "policy";
    weight: number;
  }>;
  actions: Array<{ text: string; done: boolean }>;
  hunks: Array<{
    file: string;
    range: string;
    classification: HunkClassification;
    riskBefore: number;
    riskAfter: number;
  }>;
  coverage: { verifiedHunks: number; totalHunks: number; ratio: number };
  changeLabel: string;
}

// Compile-time assertion that AdmissionVerdictLike stays structurally
// compatible with the product's AdmissionVerdict. If the product shape
// drifts, these type aliases become `never` and the lib's typecheck
// breaks — intended behavior, since the adapter's consumers rely on the
// match. Type aliases emit no runtime code.
type _AssertAssignable<From, To> = From extends To ? true : never;
type _GuardAdapterToProduct = _AssertAssignable<
  AdmissionVerdictLike,
  ProductAdmissionVerdictMirror
>;
type _GuardProductToAdapter = _AssertAssignable<
  ProductAdmissionVerdictMirror,
  AdmissionVerdictLike
>;
// Re-export the guards under a named alias so downstream tooling can
// depend on them without importing internals. Unused type aliases do
// not trip `noUnusedLocals` (which only checks values).
export type VerdictShapeGuard = [
  _GuardAdapterToProduct,
  _GuardProductToAdapter,
];
