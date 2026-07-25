import type { RequestFlow } from "../model/types";

const checkout: RequestFlow = {
  id: "checkout-submit",
  label: "Checkout · submit order",
  entrypoint: "POST /api/orders",
  budgetMs: 800,
  observedP99Ms: 612,
  nodes: [
    { id: "edge", label: "Edge router", stage: "entry", p50Ms: 4, p99Ms: 9, errorRate: 0.001, rps: 142, owner: "@infra" },
    { id: "ctrl", label: "OrdersController.submit", stage: "controller", file: "src/api/orders/controller.ts", line: 41, p50Ms: 6, p99Ms: 14, errorRate: 0.004, rps: 142, owner: "@checkout" },
    { id: "auth", label: "AuthGuard.assertSession", stage: "controller", file: "src/api/auth/guard.ts", line: 22, p50Ms: 2, p99Ms: 7, errorRate: 0.0, rps: 142, owner: "@platform" },
    { id: "svc", label: "OrderService.place", stage: "service", file: "src/domain/order/service.ts", line: 88, p50Ms: 28, p99Ms: 110, errorRate: 0.012, rps: 142, owner: "@checkout" },
    { id: "stk", label: "InventoryClient.reserve", stage: "external", file: "src/clients/inventory.ts", line: 34, p50Ms: 41, p99Ms: 215, errorRate: 0.018, rps: 142, owner: "@catalog", tag: "retried" },
    { id: "pay", label: "StripeClient.charge", stage: "external", file: "src/clients/stripe.ts", line: 51, p50Ms: 92, p99Ms: 340, errorRate: 0.006, rps: 138, owner: "@payments" },
    { id: "repo", label: "OrderRepo.persist", stage: "repo", file: "src/infra/db/order-repo.ts", line: 19, p50Ms: 7, p99Ms: 22, errorRate: 0.001, rps: 138, owner: "@checkout" },
    { id: "queue", label: "outbox.enqueue", stage: "sink", file: "src/infra/outbox.ts", line: 12, p50Ms: 2, p99Ms: 5, errorRate: 0.0, rps: 138, owner: "@platform" },
  ],
  edges: [
    { from: "edge", to: "ctrl", share: 1.0 },
    { from: "ctrl", to: "auth", share: 1.0 },
    { from: "auth", to: "svc", share: 1.0 },
    { from: "svc", to: "stk", share: 1.0 },
    { from: "stk", to: "pay", share: 0.97, conditional: true, predicate: "stock.reserved === true" },
    { from: "pay", to: "repo", share: 1.0 },
    { from: "repo", to: "queue", share: 1.0 },
  ],
};

const search: RequestFlow = {
  id: "search-query",
  label: "Search · query",
  entrypoint: "GET /api/search",
  budgetMs: 250,
  observedP99Ms: 184,
  nodes: [
    { id: "edge", label: "Edge router", stage: "entry", p50Ms: 3, p99Ms: 8, errorRate: 0.0, rps: 1240, owner: "@infra" },
    { id: "ctrl", label: "SearchController.query", stage: "controller", p50Ms: 4, p99Ms: 11, errorRate: 0.0, rps: 1240, owner: "@search" },
    { id: "cache", label: "RedisCache.get", stage: "service", p50Ms: 1, p99Ms: 3, errorRate: 0.0, rps: 1240, owner: "@platform", tag: "cache-hit" },
    { id: "es", label: "ElasticClient.search", stage: "external", p50Ms: 38, p99Ms: 142, errorRate: 0.003, rps: 312, owner: "@search" },
    { id: "rank", label: "RankingService.score", stage: "service", p50Ms: 6, p99Ms: 22, errorRate: 0.0, rps: 312, owner: "@ml" },
  ],
  edges: [
    { from: "edge", to: "ctrl", share: 1.0 },
    { from: "ctrl", to: "cache", share: 1.0 },
    { from: "cache", to: "es", share: 0.25, conditional: true, predicate: "cache.miss" },
    { from: "es", to: "rank", share: 1.0 },
  ],
};

export const REQUEST_FLOWS: Record<string, RequestFlow[]> = {
  __default: [checkout, search],
  "controller.ts": [checkout],
  "service.ts": [checkout, search],
  "search.ts": [search],
};

export function getRequestFlow(fileName: string | undefined): RequestFlow[] {
  if (!fileName) return REQUEST_FLOWS.__default;
  const exact = REQUEST_FLOWS[fileName];
  if (exact) return exact;
  for (const key of Object.keys(REQUEST_FLOWS)) {
    if (key !== "__default" && fileName.endsWith(key)) return REQUEST_FLOWS[key];
  }
  return REQUEST_FLOWS.__default;
}
