/**
 * Design Intent vs Implementation Gap — entity model.
 *
 * Compares documented intent (ADRs, RFCs, docstrings, test names, type
 * contracts) against the current implementation and surfaces drift.
 */

export type IntentSource =
  | "adr"
  | "docstring"
  | "test-name"
  | "type-contract"
  | "rfc";

export type GapStatus = "matches" | "drifted" | "violated" | "missing";

export type GapSeverity = "info" | "warn" | "danger";

export interface IntentClaim {
  id: string;
  source: IntentSource;
  /** Where the claim was authored — e.g. "ADR-007", "RFC-02",
   *  "test_orchestrator.py:test_handles_timeout". */
  sourceRef: string;
  /** Human-readable claim text in natural language. */
  text: string;
  /** ISO date the claim was authored / last updated in spec. */
  authoredAt: string;
}

export interface ImplEvidence {
  id: string;
  line: number;
  /** Small code excerpt linking the evidence to a concrete file location. */
  snippet: string;
  /** Dotted symbol path, e.g. "orchestrator.dispatch". */
  symbolPath: string;
}

export interface IntentGap {
  claimId: string;
  status: GapStatus;
  /** `null` when the claim has no implementation evidence (vaporware). */
  evidence: ImplEvidence | null;
  /** Human explanation of why the implementation matches/diverges. */
  rationale: string;
  /** ISO date the drift first appeared (commit-level resolution). */
  introducedAt?: string;
  /** Commit sha or author attribution for the drift. */
  introducedBy?: string;
  severity: GapSeverity;
}

export interface DriftEvent {
  date: string;
  status: GapStatus;
  claimId: string;
}

export interface IntentReport {
  fileName: string;
  claims: IntentClaim[];
  gaps: IntentGap[];
  /** 0-100 alignment score, weighted by severity. */
  alignmentScore: number;
  driftTimeline: DriftEvent[];
}
