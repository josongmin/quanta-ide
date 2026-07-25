import type { TransactionMap } from "../model/types";

const def: TransactionMap = {
  boundaries: [
    {
      id: "place-order-tx",
      label: "place order",
      kind: "db-tx",
      startSymbol: "db.transaction.begin",
      startFile: "src/domain/order/service.ts",
      startLine: 96,
      endSymbol: "db.transaction.commit",
      endFile: "src/domain/order/service.ts",
      endLine: 162,
      steps: [
        { id: "s1", kind: "db-write", symbol: "OrderRepo.insert", file: "src/infra/db/order-repo.ts", line: 19, crossesBoundary: false },
        { id: "s2", kind: "db-write", symbol: "InventoryRepo.decrement", file: "src/infra/db/inventory-repo.ts", line: 33, crossesBoundary: false },
        { id: "s3", kind: "external-call", symbol: "StripeClient.charge", file: "src/clients/stripe.ts", line: 51, crossesBoundary: true, note: "Network call inside DB tx — long lock + non-atomic with payment." },
        { id: "s4", kind: "queue-publish", symbol: "outbox.enqueue", file: "src/infra/outbox.ts", line: 12, crossesBoundary: false, note: "Outbox row written in same tx — safe." },
      ],
      findings: [
        { severity: "danger", message: "External call (Stripe) holds a DB transaction open — connection held for ~340ms p99. Move to outbox + async charge." },
        { severity: "warn", message: "Two writes (Order + Inventory) committed atomically with payment external call — partial-success window exists." },
      ],
    },
    {
      id: "checkout-saga",
      label: "checkout saga",
      kind: "saga",
      startSymbol: "CheckoutSaga.start",
      startFile: "src/domain/checkout/saga.ts",
      startLine: 14,
      endSymbol: "CheckoutSaga.complete",
      endFile: "src/domain/checkout/saga.ts",
      endLine: 88,
      steps: [
        { id: "s1", kind: "external-call", symbol: "InventoryClient.reserve", file: "src/clients/inventory.ts", line: 34, crossesBoundary: true, compensation: "InventoryClient.release" },
        { id: "s2", kind: "external-call", symbol: "PaymentsClient.authorize", file: "src/clients/payments.ts", line: 22, crossesBoundary: true, compensation: "PaymentsClient.void" },
        { id: "s3", kind: "external-call", symbol: "ShippingClient.book", file: "src/clients/shipping.ts", line: 19, crossesBoundary: true, compensation: undefined, note: "No compensation registered — failure leaves shipping booked." },
        { id: "s4", kind: "queue-publish", symbol: "events.OrderConfirmed", file: "src/infra/bus.ts", line: 41, crossesBoundary: false },
      ],
      findings: [
        { severity: "danger", message: "ShippingClient.book has no compensation — saga rollback leaks a booked shipment." },
        { severity: "info", message: "Saga step retries are idempotent via shared idempotency key." },
      ],
    },
  ],
};

export const TX_BOUNDARIES: Record<string, TransactionMap> = { __default: def };

export function getTransactionMap(fileName: string | undefined): TransactionMap {
  if (!fileName) return TX_BOUNDARIES.__default;
  return TX_BOUNDARIES[fileName] ?? TX_BOUNDARIES.__default;
}
