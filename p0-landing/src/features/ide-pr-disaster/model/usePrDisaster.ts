import { create } from "zustand";

interface PrDisasterState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const usePrDisaster = create<PrDisasterState>()((set) => ({
  isOpen: false,
  open: () => { set({ isOpen: true }); },
  close: () => { set({ isOpen: false }); },
  toggle: () => { set((s) => ({ isOpen: !s.isOpen })); },
}));

export type AffectedWhyKey =
  | "importsRefund"
  | "sharesDbUpdate"
  | "callsProcessRefund"
  | "indirectLedger"
  | "sessionCoupling";

export interface AffectedFile {
  path: string;
  whyKey: AffectedWhyKey;
  risk: 1 | 2 | 3 | 4;
}

export interface BrokenTest {
  name: string;
  file: string;
  uncovered: boolean;
}

export interface ConflictPeer {
  author: string;
  pr: string;
  file: string;
  overlap: string;
}

export const DISASTER_DATA = {
  changedFiles: 3,
  realImpact: 47,
  changedFilesList: [
    "src/payments/refund.ts",
    "src/payments/refund.test.ts",
    "src/lib/validation.ts",
  ],
  affected: [
    { path: "src/payments/charge.ts", whyKey: "importsRefund", risk: 3 },
    { path: "src/payments/ledger.ts", whyKey: "sharesDbUpdate", risk: 3 },
    { path: "src/webhooks/handler.ts", whyKey: "callsProcessRefund", risk: 4 },
    { path: "src/billing/invoice.ts", whyKey: "indirectLedger", risk: 2 },
    { path: "src/auth/session.ts", whyKey: "sessionCoupling", risk: 4 },
  ] as AffectedFile[],
  brokenTests: [
    { name: "test_zero_amount_rejection", file: "refund.test.ts", uncovered: false },
    { name: "test_negative_returns_400", file: "refund.test.ts", uncovered: false },
    { name: "test_session_validate_amount", file: "session.test.ts", uncovered: true },
    { name: "test_billing_invoice_recalc", file: "invoice.test.ts", uncovered: true },
    { name: "test_webhook_retry_idempotent", file: "handler.test.ts", uncovered: false },
    { name: "test_ledger_double_write", file: "ledger.test.ts", uncovered: true },
    { name: "test_charge_retry_429", file: "charge.test.ts", uncovered: false },
    { name: "test_refund_partial", file: "refund.test.ts", uncovered: true },
  ] as BrokenTest[],
  newTaintPaths: 2,
  conflicts: [
    { author: "@kimdev", pr: "#231", file: "auth/session.ts", overlap: "validateAmount" },
    { author: "@parkdev", pr: "#229", file: "payments/charge.ts", overlap: "db.update" },
  ] as ConflictPeer[],
};
