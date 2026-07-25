import type { ContextMap } from "../model/types";

const def: ContextMap = {
  contexts: [
    { id: "checkout", name: "Checkout", pattern: "src/domain/order/**", owner: "@checkout", symbolCount: 142 },
    { id: "catalog",  name: "Catalog",  pattern: "src/domain/catalog/**", owner: "@catalog",  symbolCount: 96 },
    { id: "billing",  name: "Billing",  pattern: "src/domain/billing/**", owner: "@payments", symbolCount: 58 },
    { id: "identity", name: "Identity", pattern: "src/domain/auth/**",    owner: "@platform", symbolCount: 34 },
    { id: "fulfillment", name: "Fulfillment", pattern: "src/domain/fulfillment/**", owner: "@logistics", symbolCount: 71 },
  ],
  edges: [
    { from: "checkout", to: "catalog",  kind: "anti-corruption", weight: 8 },
    { from: "checkout", to: "billing",  kind: "customer-supplier", weight: 12 },
    { from: "checkout", to: "identity", kind: "open-host", weight: 4 },
    { from: "checkout", to: "fulfillment", kind: "violation", weight: 5 },
    { from: "catalog",  to: "checkout", kind: "violation", weight: 3 },
    { from: "billing",  to: "identity", kind: "open-host", weight: 2 },
    { from: "fulfillment", to: "catalog", kind: "anti-corruption", weight: 4 },
  ],
  violations: [
    {
      id: "v1",
      fromContext: "checkout",
      toContext: "fulfillment",
      symbol: "OrderService.placeV2",
      file: "src/domain/order/service.ts",
      line: 138,
      reaches: "FulfillmentRepo.reserveSlot · raw DB write outside fulfillment service",
      reason: "Reaches across context with no contract — should call FulfillmentService.reserve instead.",
      severity: "danger",
    },
    {
      id: "v2",
      fromContext: "checkout",
      toContext: "fulfillment",
      symbol: "OrderService.cancel",
      file: "src/domain/order/service.ts",
      line: 184,
      reaches: "FulfillmentRepo.releaseSlot",
      reason: "Same anti-pattern as placeV2 — bypasses fulfillment context invariants.",
      severity: "danger",
    },
    {
      id: "v3",
      fromContext: "catalog",
      toContext: "checkout",
      symbol: "ProductService.priceFor",
      file: "src/domain/catalog/product-service.ts",
      line: 58,
      reaches: "OrderTotal.calculate",
      reason: "Catalog importing checkout pricing logic — pricing belongs in billing.",
      severity: "warn",
    },
  ],
};

export const CONTEXT_MAPS: Record<string, ContextMap> = { __default: def };

export function getContextMap(fileName: string | undefined): ContextMap {
  if (!fileName) return CONTEXT_MAPS.__default;
  return CONTEXT_MAPS[fileName] ?? CONTEXT_MAPS.__default;
}
