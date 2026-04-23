import type { EngineeringGoal, GoalStatus } from "../model/types";
import { daysAgo, hoursAgo } from "@quanta/app-autopilot/shared/lib";

export const GOALS: readonly EngineeringGoal[] = [
  {
    id: "goal_billing_structural_health",
    name: "Billing — structural health",
    description:
      "Drive billing's structural debt down. Cycles first, then layer violations. Public API stays untouched.",
    scope: { paths: ["services/billing/**"] },
    targets: [
      {
        metric: "dependency_cycles",
        operator: "eq",
        value: 0,
        weight: 2,
        narrativeIntent: "Unblock the billing orchestrator extraction by removing all cycles.",
      },
      { metric: "god_class_burden", operator: "lte", value: 20, weight: 1 },
    ],
    guardrails: [
      {
        metric: "public_api_breakages",
        operator: "eq",
        value: 0,
        severity: "block",
      },
      {
        metric: "layer_violations_delta",
        operator: "lte",
        value: 0,
        severity: "block",
      },
    ],
    owner: { kind: "team", id: "payments", displayName: "Payments" },
    mode: "enforce",
    autonomyProfile: "senior_guided_refactor",
    executionBudget: { maxFilesPerPr: 10, maxPrsPerRun: 3, maxParallelTasks: 2 },
    baselineSnapshotId: "snap_2026_04_16_argon_main",
    metricVersionSet: {
      dependency_cycles: "2.1.0",
      god_class_burden: "1.4.2",
      public_api_breakages: "1.0.0",
      layer_violations_delta: "3.0.0",
    },
    createdAt: daysAgo(14),
    updatedAt: daysAgo(1),
  },
  {
    id: "goal_repo_arch_conformance",
    name: "Repo — architecture conformance",
    description:
      "Zero layer violations across all services. Auto-repair through rule_repair operator.",
    scope: { repo: true },
    targets: [
      {
        metric: "layer_violations",
        operator: "eq",
        value: 0,
        weight: 1,
      },
    ],
    guardrails: [
      { metric: "public_api_breakages", operator: "eq", value: 0, severity: "block" },
    ],
    owner: { kind: "team", id: "platform", displayName: "Platform" },
    mode: "enforce",
    autonomyProfile: "safe_production",
    executionBudget: { maxFilesPerPr: 8, maxPrsPerRun: 4, maxParallelTasks: 3 },
    baselineSnapshotId: "snap_2026_04_16_argon_main",
    metricVersionSet: {
      layer_violations: "3.0.0",
      public_api_breakages: "1.0.0",
    },
    createdAt: daysAgo(21),
    updatedAt: hoursAgo(5),
  },
  {
    id: "goal_test_resilience",
    name: "Test resilience",
    description: "Raise coverage on hotspots and bring flaky rate under 2%.",
    scope: { paths: ["services/**"] },
    targets: [
      { metric: "coverage", operator: "gte", value: 0.85 },
      { metric: "flaky_rate", operator: "lte", value: 0.02 },
    ],
    guardrails: [],
    owner: { kind: "team", id: "platform", displayName: "Platform" },
    mode: "suggest",
    autonomyProfile: "safe_production",
    executionBudget: { maxFilesPerPr: 6, maxPrsPerRun: 2, maxParallelTasks: 2 },
    baselineSnapshotId: "snap_2026_04_16_argon_main",
    metricVersionSet: {
      coverage: "1.1.0",
      flaky_rate: "0.3.0",
    },
    createdAt: daysAgo(9),
    updatedAt: daysAgo(2),
  },
];

export const GOAL_STATUS: readonly GoalStatus[] = [
  {
    goalId: "goal_billing_structural_health",
    overallSatisfied: false,
    targets: [
      {
        metric: "dependency_cycles",
        current: 3,
        target: 0,
        operator: "eq",
        satisfied: false,
        deltaFromBaseline: -2,
        history: [5, 5, 4, 4, 3, 3],
      },
      {
        metric: "god_class_burden",
        current: 42,
        target: 20,
        operator: "lte",
        satisfied: false,
        deltaFromBaseline: -6,
        history: [48, 46, 44, 43, 42, 42],
      },
    ],
    lastEvaluatedAt: hoursAgo(1),
    activeWorkItemCount: 2,
    completedRunsLast7d: 5,
    abandonedRunsLast7d: 1,
  },
  {
    goalId: "goal_repo_arch_conformance",
    overallSatisfied: false,
    targets: [
      {
        metric: "layer_violations",
        current: 17,
        target: 0,
        operator: "eq",
        satisfied: false,
        deltaFromBaseline: -11,
        history: [28, 24, 21, 19, 18, 17],
      },
    ],
    lastEvaluatedAt: hoursAgo(2),
    activeWorkItemCount: 3,
    completedRunsLast7d: 8,
    abandonedRunsLast7d: 0,
  },
  {
    goalId: "goal_test_resilience",
    overallSatisfied: false,
    targets: [
      {
        metric: "coverage",
        current: 0.78,
        target: 0.85,
        operator: "gte",
        satisfied: false,
        deltaFromBaseline: 0.03,
        history: [0.75, 0.76, 0.76, 0.77, 0.78, 0.78],
      },
      {
        metric: "flaky_rate",
        current: 0.041,
        target: 0.02,
        operator: "lte",
        satisfied: false,
        deltaFromBaseline: -0.021,
        history: [0.062, 0.058, 0.052, 0.049, 0.045, 0.041],
      },
    ],
    lastEvaluatedAt: hoursAgo(4),
    activeWorkItemCount: 0,
    completedRunsLast7d: 2,
    abandonedRunsLast7d: 0,
  },
];
