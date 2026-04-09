import type { FileName } from "./model/useActiveFile";

export interface PrImpactRow {
  label: string;
  before: string;
  after: string;
  delta: string;
  resolved?: boolean;
}

export interface PrFile {
  stat: string;
  path: string;
}

export interface PrBehaviorRow {
  ok: boolean;
  text: string;
  detail?: string;
}

export interface PrHistoryRow {
  tag: string;
  text: string;
}

export interface PrDraft {
  branch: string;
  title: string;
  summary: string;
  highlightSymbol: string;
  funcName: string;
  impact: PrImpactRow[];
  reviewerGuide: { ref: string; reason: string; confidence: string };
  behavior: PrBehaviorRow[];
  history: PrHistoryRow[];
  files: PrFile[];
}

export const FILE_PR: Record<FileName, PrDraft> = {
  "refund.ts": {
    branch: "refund-sanitize → main",
    title: "refund: sanitize amount before db write",
    summary:
      "Wraps req.body.amount with sanitizeAmount() in processRefund() to remove the source → sink path. Behavior remains equivalent for valid input; invalid input now rejects with 400 instead of producing a DB error.",
    highlightSymbol: "req.body.amount",
    funcName: "processRefund()",
    impact: [
      { label: "Complexity", before: "9.2", after: "4.1", delta: "−55%" },
      { label: "Blast radius", before: "31", after: "12 files", delta: "−61%" },
      { label: "Taint paths", before: "2", after: "0", delta: "resolved", resolved: true },
      { label: "Test coverage", before: "0%", after: "72%", delta: "+4 new tests", resolved: true },
    ],
    reviewerGuide: {
      ref: "auth/session.ts:45",
      reason: "coupling slightly increased — new validateAmount() reads from session context",
      confidence: "medium",
    },
    behavior: [
      { ok: true, text: "Valid input: identical" },
      { ok: false, text: "Negative / NaN: was DB error, now 400 reject", detail: "intentional" },
    ],
    history: [
      { tag: "incident", text: "INC-2024-0312 — double refund" },
      { tag: "resolves", text: "this PR removes the same retry pattern" },
    ],
    files: [
      { stat: "+12 −4", path: "src/payments/refund.ts" },
      { stat: "+18 −0", path: "src/payments/refund.test.ts" },
      { stat: "+8 −0", path: "src/lib/validation.ts" },
    ],
  },
  "charge.ts": {
    branch: "charge-idempotency → main",
    title: "charge: add idempotency key to stripe.createIntent",
    summary:
      "Stripe createIntent currently lacks an idempotency key. On retry the same charge can fire twice. This PR threads tx.id through as the key, closing the duplicate-charge window.",
    highlightSymbol: "stripe.createIntent",
    funcName: "processCharge()",
    impact: [
      { label: "Complexity", before: "5.1", after: "5.1", delta: "0" },
      { label: "Blast radius", before: "18", after: "18 files", delta: "0" },
      { label: "Retry safety", before: "unsafe", after: "idempotent", delta: "fixed", resolved: true },
      { label: "Test coverage", before: "67%", after: "75%", delta: "+1 test", resolved: true },
    ],
    reviewerGuide: {
      ref: "adapters/stripe.ts:12",
      reason: "verify all callers pass tx.id (it is the only stable correlator)",
      confidence: "high",
    },
    behavior: [
      { ok: true, text: "First call: identical" },
      { ok: true, text: "Retry with same tx.id: returns same intent (no duplicate)" },
    ],
    history: [
      { tag: "incident", text: "INC-2024-0501 — duplicate Stripe charges" },
      { tag: "resolves", text: "this PR closes the retry race window" },
    ],
    files: [
      { stat: "+6 −2", path: "src/payments/charge.ts" },
      { stat: "+9 −0", path: "src/payments/charge.test.ts" },
    ],
  },
  "ledger.ts": {
    branch: "ledger-cleanup → main",
    title: "ledger: remove dead writeLegacyLedger",
    summary:
      "writeLegacyLedger has zero callers since the appendLedger migration 6 months ago. Removing it eliminates 47 LOC of dead code and clarifies the ledger surface.",
    highlightSymbol: "writeLegacyLedger",
    funcName: "appendLedger()",
    impact: [
      { label: "Complexity", before: "2.4", after: "2.4", delta: "0" },
      { label: "LOC", before: "186", after: "139", delta: "−47", resolved: true },
      { label: "Dead funcs", before: "1", after: "0", delta: "removed", resolved: true },
      { label: "Public surface", before: "3", after: "2", delta: "−1 export" },
    ],
    reviewerGuide: {
      ref: "ledger.ts:10",
      reason: "no callers in repo or string references — verified via find references",
      confidence: "high",
    },
    behavior: [
      { ok: true, text: "Runtime: unchanged" },
      { ok: true, text: "Build: −47 LOC, no broken imports" },
    ],
    history: [
      { tag: "migration", text: "appendLedger replaced legacy 6mo ago" },
      { tag: "cleanup", text: "this PR finishes the migration" },
    ],
    files: [
      { stat: "+0 −47", path: "src/payments/ledger.ts" },
    ],
  },
};
