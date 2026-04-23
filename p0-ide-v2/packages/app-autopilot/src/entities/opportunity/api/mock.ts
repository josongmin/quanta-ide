import type { Opportunity } from "../model/types";
import { daysAgo } from "@quanta/app-autopilot/shared/lib";

export const OPPORTUNITIES: readonly Opportunity[] = [
  {
    id: "opp_ledger_legacy_cleanup",
    kind: "dead_code",
    title: "Remove legacy ledger module",
    summary:
      "870 LoC unreachable from any public entry. Last touched 14 months ago. Ownership: payments.",
    paths: ["services/ledger/src/legacy/"],
    score: 88,
    contributingMetrics: ["dead_code_loc"],
    suggestedOperator: "dependency_hygiene",
    createdAt: daysAgo(3),
    ageDays: 3,
  },
  {
    id: "opp_auth_session_cycle",
    kind: "dependency_cycle",
    title: "Break auth session cycle",
    summary:
      "3-participant cycle: resolver → store → validator → resolver. Blocks isolation of session middleware.",
    paths: ["services/auth/src/session/"],
    score: 76,
    contributingMetrics: ["dependency_cycles"],
    suggestedOperator: "refactor",
    createdAt: daysAgo(6),
    ageDays: 6,
  },
  {
    id: "opp_flaky_payment_suite",
    kind: "flaky_test",
    title: "Stabilize billing e2e flakes",
    summary:
      "6 tests flip verdict > 8% in last 14 days. Likely root cause: shared Stripe fixture not reset.",
    paths: ["services/billing/test/e2e/"],
    score: 71,
    contributingMetrics: ["flaky_rate"],
    suggestedOperator: "test_generation",
    createdAt: daysAgo(4),
    ageDays: 4,
  },
  {
    id: "opp_dashboard_layer_leak",
    kind: "layer_violation",
    title: "Dashboard UI→domain direct imports",
    summary:
      "4 UI→domain direct imports in billing feature. Mechanical fix via rewrite_imports.",
    paths: ["apps/dashboard/src/features/billing/"],
    score: 52,
    contributingMetrics: ["layer_violations"],
    suggestedOperator: "rule_repair",
    createdAt: daysAgo(1),
    ageDays: 1,
  },
  {
    id: "opp_pricing_rates_infra",
    kind: "layer_violation",
    title: "Pricing infra imports domain",
    summary:
      "Rates gateway and FX provider in infra/ both pull from domain/. Wrong direction; infra depends on domain.",
    paths: [
      "services/pricing/src/infra/rates-gateway.ts",
      "services/pricing/src/infra/fx-provider.ts",
    ],
    score: 58,
    contributingMetrics: ["layer_violations"],
    suggestedOperator: "rule_repair",
    createdAt: daysAgo(2),
    ageDays: 2,
  },
  {
    id: "opp_missing_tests_pricing",
    kind: "missing_test",
    title: "Pricing rounding — no tests",
    summary:
      "applyTierRounding has fan-in 11 and zero tests. High-leverage characterization target.",
    paths: ["services/pricing/src/domain/tier-rounding.ts"],
    score: 49,
    contributingMetrics: ["coverage"],
    suggestedOperator: "test_generation",
    createdAt: daysAgo(5),
    ageDays: 5,
  },
];
