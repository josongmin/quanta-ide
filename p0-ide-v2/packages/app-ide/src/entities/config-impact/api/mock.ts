import type { ConfigImpact } from "../model/types";

const defaultImpact: ConfigImpact = {
  knobs: [
    {
      id: "flag.checkout-v2",
      name: "checkout.v2",
      kind: "feature-flag",
      type: "bool",
      purpose: "Switch checkout to the v2 pipeline (Stripe Treasury + new fraud check).",
      current: true,
      values: [true, false],
      owner: "@checkout",
      branches: [
        {
          when: "flag === true",
          effect: "v2 pipeline · adds fraud probe + 3DS challenge",
          refs: [
            { file: "src/api/orders/controller.ts", line: 51, snippet: "if (flags.checkoutV2) return submitV2(req)", symbol: "OrdersController.submit" },
            { file: "src/domain/order/service.ts", line: 102, snippet: "await fraudClient.probe(order)", symbol: "OrderService.placeV2" },
          ],
          reaches: ["FraudClient.probe", "Stripe3DS.challenge", "OrderService.placeV2"],
        },
        {
          when: "flag === false",
          effect: "legacy v1 path · skips fraud probe",
          refs: [
            { file: "src/api/orders/controller.ts", line: 56, snippet: "return submitV1(req)", symbol: "OrdersController.submit" },
          ],
          reaches: ["OrderService.placeV1"],
        },
      ],
      refs: [],
    },
    {
      id: "env.MAX_ORDER_LINE_ITEMS",
      name: "MAX_ORDER_LINE_ITEMS",
      kind: "env",
      type: "number",
      purpose: "Hard cap on cart size — protects DB write batch.",
      current: 50,
      owner: "@platform",
      branches: [
        {
          when: "items.length > MAX",
          effect: "throws 422 — order rejected",
          refs: [
            { file: "src/domain/order/service.ts", line: 71, snippet: "if (items.length > MAX_ORDER_LINE_ITEMS) throw new TooManyItemsError()" },
          ],
          reaches: ["TooManyItemsError"],
        },
      ],
      refs: [
        { file: "src/api/orders/controller.ts", line: 38, snippet: "validate.cartSize(req.body.items, MAX_ORDER_LINE_ITEMS)" },
      ],
    },
    {
      id: "remote.fraud-threshold",
      name: "fraud.minScore",
      kind: "remote-config",
      type: "number",
      purpose: "Minimum fraud score (0..1) to auto-decline an order.",
      current: 0.85,
      owner: "@fraud",
      branches: [
        {
          when: "score >= threshold",
          effect: "auto-decline + flag for review",
          refs: [
            { file: "src/domain/order/service.ts", line: 118, snippet: "if (score >= fraudConfig.minScore) return decline(order)" },
          ],
          reaches: ["OrderService.decline", "ReviewQueue.push"],
        },
      ],
      refs: [],
    },
  ],
};

export const CONFIG_IMPACTS: Record<string, ConfigImpact> = {
  __default: defaultImpact,
};

export function getConfigImpact(fileName: string | undefined): ConfigImpact {
  if (!fileName) return CONFIG_IMPACTS.__default;
  return CONFIG_IMPACTS[fileName] ?? CONFIG_IMPACTS.__default;
}
