import type { ReactNode } from "react";
import type { ChangeProposal } from "@/features/ide-change-card";
import type { FileName } from "./model/useActiveFile";

export interface FixContent {
  titleKey: string;
  code: ReactNode;
  meta: { kKey: string; v: string }[];
  proposal: ChangeProposal;
}

const REFUND_FIX: FixContent = {
  titleKey: "ide.fixes.refund.title",
  code: (
    <>
      <span>{"  const amount = req.body.amount;\n"}</span>
      <span className="add">{"+ const safe = sanitizeAmount(amount);\n"}</span>
      <span className="del">{"- await db.update(tx);\n"}</span>
      <span className="add">{"+ await db.update({ ...tx, amount: safe });"}</span>
    </>
  ),
  meta: [
    { kKey: "behavior", v: "equivalent" },
    { kKey: "risk", v: "−1 path" },
    { kKey: "confidence", v: "high" },
    { kKey: "tests", v: "+2" },
  ],
  proposal: {
    id: "agent-refund-001",
    source: "agent",
    title: "Insert sanitizer before db.update",
    summary:
      "Wraps tainted req.body.amount with sanitizeAmount() to remove the source→sink path.",
    diff: [
      { line: 6, type: "ctx", text: "  const amount = req.body.amount;" },
      { line: 7, type: "add", text: "  const safe = sanitizeAmount(amount);" },
      { line: 8, type: "ctx", text: "  const validated = parse(safe);" },
      { line: 9, type: "ctx", text: "  const tx = build(validated);" },
      { line: 10, type: "del", text: "  await db.update(tx);" },
      { line: 10, type: "add", text: "  await db.update({ ...tx, amount: safe });" },
    ],
    impact: { blastBefore: 31, blastAfter: 31, testsAtRisk: 0, testsBroken: 0, taintDelta: -1 },
    behavior: [
      { change: "amount === 0 → reject (was: DB error)", intentional: true },
      { change: "negative amount → reject (was: DB error)", intentional: true },
    ],
    risk: "low",
    confidence: "high",
    evidence: [
      { label: "Taint path resolved", loc: "refund.ts:6 → refund.ts:10" },
      { label: "sanitizeAmount() exists", loc: "lib/validation.ts:23" },
      { label: "Used in 47 other places", loc: "find references" },
    ],
    verification: { behavior: "equivalent", sideEffects: "equivalent", tests: "passing" },
  },
};

const CHARGE_FIX: FixContent = {
  titleKey: "ide.fixes.charge.title",
  code: (
    <>
      <span>{"  const intent = await stripe.createIntent(\n"}</span>
      <span>{"    customerId, amount\n"}</span>
      <span className="del">{"- );\n"}</span>
      <span className="add">{"+   , { idempotencyKey: tx.id });\n"}</span>
    </>
  ),
  meta: [
    { kKey: "behavior", v: "equivalent" },
    { kKey: "risk", v: "−2 retry" },
    { kKey: "confidence", v: "high" },
    { kKey: "tests", v: "+1" },
  ],
  proposal: {
    id: "agent-charge-001",
    source: "agent",
    title: "Idempotency key on createIntent",
    summary:
      "Stripe createIntent currently lacks an idempotency key. On retry the same charge can fire twice. Adding tx.id closes the duplicate-charge window.",
    diff: [
      { line: 6, type: "ctx", text: "  const intent = await stripe.createIntent(" },
      { line: 7, type: "ctx", text: "    customerId," },
      { line: 8, type: "del", text: "    amount" },
      { line: 8, type: "add", text: "    amount," },
      { line: 9, type: "add", text: "    { idempotencyKey: tx.id }" },
      { line: 10, type: "ctx", text: "  );" },
    ],
    impact: { blastBefore: 18, blastAfter: 18, testsAtRisk: 1, testsBroken: 0, taintDelta: 0 },
    behavior: [
      { change: "first call: unchanged", intentional: true },
      { change: "retry with same tx.id: returns same intent (no duplicate)", intentional: true },
    ],
    risk: "low",
    confidence: "high",
    evidence: [
      { label: "Stripe SDK supports idempotencyKey", loc: "@stripe/node:8.0+" },
      { label: "tx.id already unique per charge", loc: "charge.ts:7" },
      { label: "Used in 6 other adapters", loc: "find references" },
    ],
    verification: { behavior: "equivalent", sideEffects: "equivalent", tests: "passing" },
  },
};

const LEDGER_FIX: FixContent = {
  titleKey: "ide.fixes.ledger.title",
  code: (
    <>
      <span>{"  // dead — replaced by appendLedger\n"}</span>
      <span className="del">{"- function writeLegacyLedger() { … }"}</span>
    </>
  ),
  meta: [
    { kKey: "behavior", v: "equivalent" },
    { kKey: "risk", v: "0" },
    { kKey: "confidence", v: "high" },
    { kKey: "loc", v: "−47" },
  ],
  proposal: {
    id: "agent-ledger-001",
    source: "agent",
    title: "Remove dead writeLegacyLedger",
    summary:
      "writeLegacyLedger has zero callers since the appendLedger migration 6 months ago. Safe to delete.",
    diff: [
      { line: 9, type: "del", text: "// dead — replaced by appendLedger" },
      { line: 10, type: "del", text: "function writeLegacyLedger() { … }" },
    ],
    impact: { blastBefore: 8, blastAfter: 8, testsAtRisk: 0, testsBroken: 0, taintDelta: 0 },
    behavior: [{ change: "no callers — runtime unchanged", intentional: true }],
    risk: "low",
    confidence: "high",
    evidence: [
      { label: "Zero callers", loc: "find references" },
      { label: "Last call removed", loc: "git log: 6mo ago" },
      { label: "No string references", loc: "grep -r writeLegacyLedger" },
    ],
    verification: { behavior: "equivalent", sideEffects: "equivalent", tests: "passing" },
  },
};

export const FILE_FIXES: Record<FileName, FixContent> = {
  "refund.ts": REFUND_FIX,
  "charge.ts": CHARGE_FIX,
  "ledger.ts": LEDGER_FIX,
};
