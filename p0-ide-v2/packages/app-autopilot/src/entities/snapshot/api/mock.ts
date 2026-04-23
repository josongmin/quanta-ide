import type { RepositorySnapshot } from "../model/types";
import { daysAgo } from "@quanta/app-autopilot/shared/lib";

/**
 * Current repository snapshot — the foundational fact about the repo that
 * goals evaluate against and proofs consume/emit.
 *
 * Scenario: a mature fintech monorepo ("argon") with billing/auth/ledger
 * services, moderately sized frontend, and accumulated structural debt.
 */
export const CURRENT_SNAPSHOT: RepositorySnapshot = {
  id: "snap_2026_04_23_argon_main",
  repoRevision: "9f4d21c",
  capturedAt: daysAgo(0),
  metrics: {
    dependency_cycles: 3,
    layer_violations: 17,
    god_class_burden: 42,
    dead_code_loc: 2_140,
    coverage: 0.78,
    flaky_rate: 0.041,
    public_api_breakages: 0,
    layer_violations_delta: 0,
  },
  metricHistory: {
    dependency_cycles: [7, 7, 6, 6, 5, 5, 4, 4, 3, 3],
    layer_violations: [42, 39, 36, 33, 31, 28, 24, 21, 19, 17],
    god_class_burden: [58, 56, 55, 52, 50, 48, 46, 44, 43, 42],
    dead_code_loc: [3_200, 3_180, 3_050, 2_920, 2_700, 2_520, 2_410, 2_300, 2_220, 2_140],
    coverage: [0.71, 0.72, 0.72, 0.73, 0.74, 0.75, 0.75, 0.76, 0.77, 0.78],
    flaky_rate: [0.085, 0.082, 0.078, 0.074, 0.069, 0.062, 0.058, 0.052, 0.047, 0.041],
  },
  hotspots: [
    {
      id: "hot_billing_orchestrator",
      kind: "god_class",
      path: "services/billing/src/orchestrator.ts",
      score: 84,
      drivers: ["12 responsibilities", "fan-in 37", "2y churn"],
    },
    {
      id: "hot_auth_session_store",
      kind: "cycle",
      path: "services/auth/src/session/",
      score: 71,
      drivers: ["imports resolver", "resolver imports store", "3 participants"],
    },
    {
      id: "hot_ledger_legacy",
      kind: "dead_code",
      path: "services/ledger/src/legacy/",
      score: 64,
      drivers: ["870 LoC unreachable", "last touched 14mo ago"],
    },
    {
      id: "hot_pricing_layer",
      kind: "layer_violation",
      path: "services/pricing/src/",
      score: 58,
      drivers: ["7 imports cross domain→infra", "recent"],
    },
  ],
  ownership: [
    { path: "services/billing/", team: "payments", contributors: ["lena.b", "joon", "miyuki"] },
    { path: "services/auth/", team: "platform", contributors: ["raphaela", "daveed"] },
    { path: "services/ledger/", team: "payments", contributors: ["joon", "viktor"] },
    { path: "services/pricing/", team: "growth", contributors: ["miyuki", "aniket"] },
    { path: "apps/dashboard/", team: "web", contributors: ["jo", "anya", "frederic"] },
  ],
  violations: [
    {
      id: "v_arch_001",
      kind: "layer_violation",
      path: "services/pricing/src/infra/rates-gateway.ts",
      severity: "warn",
      description: "infra layer imports from domain (tier-down)",
    },
    {
      id: "v_arch_002",
      kind: "layer_violation",
      path: "services/pricing/src/infra/fx-provider.ts",
      severity: "warn",
      description: "infra layer imports from domain (tier-down)",
    },
    {
      id: "v_arch_003",
      kind: "import_boundary",
      path: "services/billing/src/orchestrator.ts",
      severity: "error",
      description: "crosses services/auth/internal/*",
    },
    {
      id: "v_arch_004",
      kind: "layer_violation",
      path: "apps/dashboard/src/features/billing/BillingChart.tsx",
      severity: "info",
      description: "ui imports domain directly (should go through adapters)",
    },
  ],
  opportunities: [
    {
      id: "opp_ledger_legacy_cleanup",
      kind: "dead_code",
      path: "services/ledger/src/legacy/",
      score: 88,
      rationale: "870 LoC unreachable, low fan-in, no recent touches",
    },
    {
      id: "opp_auth_session_cycle",
      kind: "dependency_cycle",
      path: "services/auth/src/session/",
      score: 76,
      rationale: "cycle with 3 participants; resolver → store → validator → resolver",
    },
    {
      id: "opp_flaky_payment_suite",
      kind: "flaky_test",
      path: "services/billing/test/e2e/",
      score: 71,
      rationale: "6 tests flip verdict > 8% in last 14d",
    },
    {
      id: "opp_dashboard_layer_leak",
      kind: "layer_violation",
      path: "apps/dashboard/src/features/billing/",
      score: 52,
      rationale: "4 ui → domain direct imports; mechanical refactor",
    },
  ],
};

/** Earlier baselines (snap_id references used by proofs). */
export const BASELINE_SNAPSHOTS: Record<string, RepositorySnapshot> = {
  snap_2026_04_16_argon_main: {
    ...CURRENT_SNAPSHOT,
    id: "snap_2026_04_16_argon_main",
    repoRevision: "4a9217f",
    capturedAt: daysAgo(7),
    metrics: {
      ...CURRENT_SNAPSHOT.metrics,
      dependency_cycles: 5,
      layer_violations: 28,
      god_class_burden: 48,
      dead_code_loc: 2_520,
      coverage: 0.75,
      flaky_rate: 0.062,
    },
  },
};
