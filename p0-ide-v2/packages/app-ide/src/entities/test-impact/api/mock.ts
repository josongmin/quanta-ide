import type { TestImpactPlan } from "../model/types";

const def: TestImpactPlan = {
  baseRef: "main…HEAD",
  totalTests: 4218,
  fullSuiteMs: 480000,
  changed: [
    { path: "src/domain/order/service.ts", added: 42, removed: 18, testDistance: 1 },
    { path: "src/api/orders/controller.ts", added: 12, removed: 4, testDistance: 1 },
    { path: "src/clients/stripe.ts", added: 8, removed: 2, testDistance: 2 },
    { path: "src/infra/outbox.ts", added: 3, removed: 1, testDistance: 1 },
  ],
  selected: [
    {
      id: "t1",
      path: "src/domain/order/service.test.ts",
      cases: ["place_order_v2", "place_order_partial_failure", "outbox_dedupe"],
      reason: "Direct unit-test for changed symbol OrderService.placeV2",
      confidence: "high",
      estMs: 1800,
      distance: 0,
    },
    {
      id: "t2",
      path: "src/api/orders/controller.test.ts",
      cases: ["submit_route_returns_201", "submit_route_validates"],
      reason: "Routes that call OrderService.placeV2",
      confidence: "high",
      estMs: 2200,
      distance: 1,
    },
    {
      id: "t3",
      path: "src/clients/stripe.test.ts",
      cases: ["charge_idempotency_key_set"],
      reason: "StripeClient.charge changed signature",
      confidence: "high",
      estMs: 600,
      distance: 0,
    },
    {
      id: "t4",
      path: "test/e2e/checkout.spec.ts",
      cases: ["happy_path_v2"],
      reason: "Touches all four changed files transitively",
      confidence: "medium",
      estMs: 18000,
      distance: 2,
    },
    {
      id: "t5",
      path: "test/contract/payments.spec.ts",
      cases: ["*"],
      reason: "Stripe contract test — runs whenever stripe.ts changes",
      confidence: "medium",
      estMs: 4200,
      distance: 1,
    },
  ],
  overallConfidence: "high",
  fallbackToFull: false,
};

export const TEST_IMPACT_PLANS: Record<string, TestImpactPlan> = { __default: def };

export function getTestImpactPlan(fileName: string | undefined): TestImpactPlan {
  if (!fileName) return TEST_IMPACT_PLANS.__default;
  return TEST_IMPACT_PLANS[fileName] ?? TEST_IMPACT_PLANS.__default;
}
