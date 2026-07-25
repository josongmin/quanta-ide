import type { IdempotencyMap } from "../model/types";

const def: IdempotencyMap = {
  risks: [
    {
      id: "stripe-charge",
      symbol: "StripeClient.charge",
      file: "src/clients/stripe.ts",
      line: 51,
      effect: "Captures funds from customer card.",
      impact: "irreversible",
      keyStrategy: "header-key",
      duplicateBehavior: "noop",
      riskScore: 18,
      retryOrigin: "client retry on 5xx",
      hasDoubleFireTest: true,
      hint: "Stripe Idempotency-Key header is set per request — confirmed safe.",
    },
    {
      id: "outbox-enqueue",
      symbol: "outbox.enqueue",
      file: "src/infra/outbox.ts",
      line: 12,
      effect: "Inserts pending event row.",
      impact: "low",
      keyStrategy: "dedupe-table",
      duplicateBehavior: "noop",
      riskScore: 8,
      retryOrigin: "tx commit retry",
      hasDoubleFireTest: true,
      hint: "Unique constraint on (aggregate_id, event_seq) absorbs duplicates.",
    },
    {
      id: "webhook-fanout",
      symbol: "WebhookDispatcher.send",
      file: "src/infra/webhook.ts",
      line: 41,
      effect: "POSTs payload to merchant URL.",
      impact: "high",
      keyStrategy: "request-id",
      duplicateBehavior: "double-effect",
      riskScore: 72,
      retryOrigin: "scheduler · 3 retries / 24h",
      hasDoubleFireTest: false,
      hint: "Merchant receives duplicate webhook on retry — add receipt-table dedupe before send.",
    },
    {
      id: "credit-balance",
      symbol: "Wallet.creditBalance",
      file: "src/domain/wallet/service.ts",
      line: 88,
      effect: "Adds funds to user wallet.",
      impact: "irreversible",
      keyStrategy: "none",
      duplicateBehavior: "double-effect",
      riskScore: 95,
      retryOrigin: "consumer redelivery",
      hasDoubleFireTest: false,
      hint: "Promote `tx_id` to natural key + UPSERT on wallet_credits — currently double-credits on consumer redelivery.",
    },
    {
      id: "send-otp",
      symbol: "OtpService.send",
      file: "src/domain/auth/otp.ts",
      line: 22,
      effect: "Sends SMS one-time code.",
      impact: "medium",
      keyStrategy: "natural-key",
      duplicateBehavior: "noop",
      riskScore: 24,
      retryOrigin: "client retry on timeout",
      hasDoubleFireTest: true,
      hint: "Coalesces by (user_id, otp_window) — duplicate sends within 60s skipped.",
    },
  ],
};

export const IDEMPOTENCY_MAPS: Record<string, IdempotencyMap> = { __default: def };

export function getIdempotencyMap(fileName: string | undefined): IdempotencyMap {
  if (!fileName) return IDEMPOTENCY_MAPS.__default;
  return IDEMPOTENCY_MAPS[fileName] ?? IDEMPOTENCY_MAPS.__default;
}
