import type {
  ChangeSet,
  RuleBinding,
  VerifierId,
  VerifyResult,
} from "./types";

/**
 * MVP verifier table. In production these would delegate to real engine
 * capabilities (arch analyzer, taint v2, behavior diff, type checker,
 * coverage reporter). For the UI-only build we return deterministic
 * mock results keyed by changeSet.id so the UI can demo end-to-end.
 */

export const VERIFIER_VERSION: Record<VerifierId, string> = {
  "arch.no-import-from":           "arch/0.6.2",
  "taint.no-sink-without-sanitizer": "taint-v2/1.1.0",
  "behavior.no-api-break":         "behavior-diff/0.4.1",
  "type.no-new-errors":            "type-check/1.0.0",
  "coverage.branch":               "coverage/0.9.3",
};

export const ENGINE_SOURCE: Record<VerifierId, string> = {
  "arch.no-import-from":           "arch rules",
  "taint.no-sink-without-sanitizer": "taint v2",
  "behavior.no-api-break":         "behavior diff",
  "type.no-new-errors":            "type check",
  "coverage.branch":               "coverage",
};

/** Rules → verifier bindings, as declared in .agent/rules.md {verify:...}. */
export const DEFAULT_RULE_BINDINGS: RuleBinding[] = [
  {
    ruleId: "arch-boundary",
    ruleLabel: "Arch: domain → infra",
    source: "rules.md §Arch",
    verifierId: "arch.no-import-from",
  },
  {
    ruleId: "taint-sink",
    ruleLabel: "Taint: save sink guarded",
    source: "rules.md §Security",
    verifierId: "taint.no-sink-without-sanitizer",
  },
  {
    ruleId: "api-stability",
    ruleLabel: "Behavior: no public API break",
    source: "rules.md §Style",
    verifierId: "behavior.no-api-break",
  },
  {
    ruleId: "type-safety",
    ruleLabel: "Type: no new errors",
    source: "rules.md §Style",
    verifierId: "type.no-new-errors",
  },
  {
    ruleId: "coverage-floor",
    ruleLabel: "Coverage: ≥ 80% branch",
    source: "rules.md §Testing",
    verifierId: "coverage.branch",
  },
];

/** Mock verifier runner — deterministic by changeSet.id for demo. */
export function runVerifier(
  id: VerifierId,
  _change: ChangeSet,
): VerifyResult {
  const engineSource = ENGINE_SOURCE[id];

  switch (id) {
    case "arch.no-import-from":
      return {
        verifierId: id,
        status: "pass",
        engineSource,
        confidence: 0.98,
        evidence: [
          { kind: "signal", signal: "arch-graph", detail: "no domain → infra edges introduced" },
          { kind: "sample", detail: "scanned 47 affected imports" },
        ],
      };
    case "taint.no-sink-without-sanitizer":
      return {
        verifierId: id,
        status: "pass",
        engineSource,
        confidence: 0.94,
        evidence: [
          { kind: "signal", signal: "taint v2", detail: "2 open paths → 0 after validate_trace() guard" },
          { kind: "signal", signal: "behavior diff", detail: "sink reachable only after sanitizer" },
        ],
      };
    case "behavior.no-api-break":
      return {
        verifierId: id,
        status: "pass",
        engineSource,
        confidence: 0.96,
        evidence: [
          { kind: "signal", signal: "behavior diff", detail: "ExperienceStore.save signature unchanged" },
          { kind: "sample", detail: "12 sample inputs identical" },
        ],
      };
    case "type.no-new-errors":
      return {
        verifierId: id,
        status: "pass",
        engineSource,
        confidence: 0.99,
        evidence: [
          { kind: "signal", signal: "tsc", detail: "0 new errors across 47 affected files" },
        ],
      };
    case "coverage.branch":
      return {
        verifierId: id,
        status: "fail",
        engineSource,
        confidence: 0.9,
        reason: "branch coverage 72% < floor 80%",
        evidence: [
          { kind: "signal", signal: "coverage", detail: "execute() has 3 uncovered branches" },
        ],
        violations: [
          { file: "orchestrator.py", line: 182, message: "3 branches uncovered in execute()" },
        ],
      };
    default:
      return {
        verifierId: id,
        status: "unknown",
        engineSource,
        confidence: 0,
        reason: "no verifier implementation",
        evidence: [],
      };
  }
}

export function runAll(
  bindings: readonly RuleBinding[],
  change: ChangeSet,
): VerifyResult[] {
  return bindings.map((b) => runVerifier(b.verifierId, change));
}
