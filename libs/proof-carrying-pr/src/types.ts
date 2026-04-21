// Proof-Carrying PR — data model (reification of docs/rfc/2026-04-15-proof-carrying-pr.md).
//
// These types are the *canonical* shape serialized to `.quanta-proof.json`
// and attached to commits as `Quanta-Proof:` trailers. Every field maps
// 1:1 to the RFC; renaming here is a breaking change for the file format.

/** Per-check outcome emitted by a single verifier against a hunk. */
export type VerifierStatus = "pass" | "fail" | "unknown";

/**
 * Four-tier hunk classification that drives reviewer attention allocation.
 *
 * - `mechanical`       rename / formatting / lint fix — verified behavior-identical.
 * - `logic-preserved`  structural change, semantic diff confirms equivalence.
 * - `new-behavior`     intended behavior change.
 * - `risky`            engine cannot verify or flagged potentially-dangerous.
 */
export type HunkClassification =
  | "mechanical"
  | "logic-preserved"
  | "new-behavior"
  | "risky";

/**
 * A single verifier's verdict on a hunk.
 *
 * @example
 * const c: HunkCheck = { verifier: "taint v2", status: "pass" };
 */
export interface HunkCheck {
  /** Verifier id + version, e.g. `"taint v2"`, `"behavior diff"`. */
  verifier: string;
  /** Outcome for this hunk. */
  status: VerifierStatus;
  /** Optional human-readable detail (error message, finding summary). */
  detail?: string;
}

/**
 * Per-hunk attestation — the unit of proof. One entry per diff hunk.
 *
 * @example
 * const a: HunkAttestation = {
 *   file: "orchestrator.py",
 *   hunkHeader: "@@ -212,6 +212,8 @@",
 *   verified: true,
 *   checks: [{ verifier: "taint v2", status: "pass" }],
 *   risk: { before: 40, after: 38 },
 *   classification: "logic-preserved",
 * };
 */
export interface HunkAttestation {
  /** Repo-relative file path. */
  file: string;
  /** Unified-diff hunk header, e.g. `"@@ -12,6 +12,8 @@"`. */
  hunkHeader: string;
  /** `true` when *every* check passed. */
  verified: boolean;
  /** Per-verifier checks. Order is preserved as emitted by the generator. */
  checks: readonly HunkCheck[];
  /** Risk score (0..100) before and after the change. */
  risk: { before: number; after: number };
  /** Reviewer-visible classification — drives review attention. */
  classification: HunkClassification;
}

/**
 * Counterfactual projection for a single branch (apply vs dismiss).
 *
 * @example
 * const p: ProjectionSummary = { cost: 2.8, unit: "eng-days", delta: 2.5 };
 */
export interface ProjectionSummary {
  /** Magnitude of projected work in {@link unit}. Must be >= 0. */
  cost: number;
  /** Currently only `"eng-days"` is modeled; kept as a string for forward compat. */
  unit: "eng-days";
  /** Optional delta vs. the baseline (no-op) branch. */
  delta?: number;
}

/**
 * The signed proof attached to a PR. Canonical on-disk payload for
 * `.quanta-proof.json`; consumers should validate via {@link parseProofJson}
 * before trusting any fields.
 */
export interface ProofCarryingPR {
  /** PR identifier (host-scoped, e.g. `"gh:org/repo#482"`). */
  prId: string;
  /** Commit SHA the proof was generated against. */
  commitSha: string;
  /** Generation time, unix epoch milliseconds. */
  generatedAt: number;
  /** Generator provenance — engine + verifier versions. */
  generator: {
    engineVersion: string;
    verifierVersions: Readonly<Record<string, string>>;
  };
  /** Hunk coverage summary — `verifiedHunks/totalHunks = ratio` (0..1). */
  coverage: {
    totalHunks: number;
    verifiedHunks: number;
    ratio: number;
  };
  /** Per-hunk attestations. May be shorter than `coverage.totalHunks` when
   *  the generator truncates; consumers should treat `coverage` as authoritative. */
  attestations: readonly HunkAttestation[];
  /** Apply-vs-dismiss counterfactual cost summary. */
  counterfactuals: {
    apply: ProjectionSummary;
    dismiss: ProjectionSummary;
  };
  /** Rule compliance aggregate (pass / fail / unknown / lies detected). */
  complianceSummary: {
    pass: number;
    fail: number;
    unknown: number;
    liesDetected: number;
  };
  /** References into the Patch Trail for the touched symbols. */
  patchTrailRefs: readonly string[];
  /** Evidence token / signature. Opaque string; verified by a separate signer. */
  signature: string;
}
