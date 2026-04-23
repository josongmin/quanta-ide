import type { OperatorSummary } from "../model/types";

export const OPERATORS: readonly OperatorSummary[] = [
  {
    id: "rule_repair",
    displayName: "Rule Repair",
    tagline:
      "Mechanical fixes for layer violations and import-boundary breaks. Deterministic, easy to verify.",
    status: "ready",
    supportedOperations: [
      "repair_layer_violation",
      "repair_import_boundary",
      "rewrite_imports",
      "safe_rename",
    ],
    supportedRiskTiers: ["low", "medium"],
    acceptanceRate: 0.94,
    recentCandidateCount: 23,
    recentAbandonCount: 2,
  },
  {
    id: "test_generation",
    displayName: "Test Generation",
    tagline:
      "Characterization + regression-backfill tests for hotspots. Deterministic verdict = tests run.",
    status: "phase-2",
    supportedOperations: ["add_tests"],
    supportedRiskTiers: ["low"],
    acceptanceRate: undefined,
    recentCandidateCount: 0,
    recentAbandonCount: 0,
  },
  {
    id: "refactor",
    displayName: "Refactor",
    tagline:
      "Class split, dependency inversion, module relocation. Gated behind senior-guided profile.",
    status: "phase-2",
    supportedOperations: [
      "extract_function",
      "extract_class",
      "move_method",
      "move_module",
      "dependency_inversion",
    ],
    supportedRiskTiers: ["low", "medium", "high"],
    acceptanceRate: undefined,
    recentCandidateCount: 0,
    recentAbandonCount: 0,
  },
  {
    id: "dependency_hygiene",
    displayName: "Dependency Hygiene",
    tagline: "Stale-dep cleanup + deprecated-API migration assistance.",
    status: "phase-2",
    supportedOperations: ["rewrite_imports", "delete_dead_code"],
    supportedRiskTiers: ["low"],
    acceptanceRate: undefined,
  },
  {
    id: "review_prep",
    displayName: "Review Prep",
    tagline: "PR risk summary, blast-radius explanation, reviewer suggestion.",
    status: "phase-2",
    supportedOperations: [],
    supportedRiskTiers: ["low"],
    acceptanceRate: undefined,
  },
];
