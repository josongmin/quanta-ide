import { create } from "zustand";

export interface ChangeProposal {
  id: string;
  source: "agent" | "user" | "fix";
  title: string;
  summary: string;
  diff: { line: number; type: "add" | "del" | "ctx"; text: string }[];
  impact: {
    blastBefore: number;
    blastAfter: number;
    testsAtRisk: number;
    testsBroken: number;
    taintDelta: number;
  };
  behavior: { change: string; intentional: boolean }[];
  risk: "low" | "medium" | "high" | "critical";
  confidence: "low" | "medium" | "high";
  evidence: { label: string; loc?: string }[];
  verification: {
    behavior: "equivalent" | "diverged";
    sideEffects: "equivalent" | "diverged";
    tests: "passing" | "failing";
  };
}

interface ChangeCardState {
  proposal: ChangeProposal | null;
  isOpen: boolean;
  open: (proposal: ChangeProposal) => void;
  close: () => void;
}

export const SAMPLE_PROPOSAL: ChangeProposal = {
  id: "agent-001",
  source: "agent",
  title: "Insert sanitizer before db.update",
  summary: "Wraps tainted req.body.amount with sanitizeAmount() to remove the source→sink path.",
  diff: [
    { line: 6, type: "ctx", text: "  const amount = req.body.amount;" },
    { line: 7, type: "add", text: "  const safe = sanitizeAmount(amount);" },
    { line: 8, type: "ctx", text: "  const validated = parse(safe);" },
    { line: 9, type: "ctx", text: "  const tx = build(validated);" },
    { line: 10, type: "del", text: "  await db.update(tx);" },
    { line: 10, type: "add", text: "  await db.update({ ...tx, amount: safe });" },
  ],
  impact: {
    blastBefore: 31,
    blastAfter: 31,
    testsAtRisk: 0,
    testsBroken: 0,
    taintDelta: -1,
  },
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
  verification: {
    behavior: "equivalent",
    sideEffects: "equivalent",
    tests: "passing",
  },
};

export const useChangeCard = create<ChangeCardState>()((set) => ({
  proposal: null,
  isOpen: false,
  open: (proposal) => { set({ proposal, isOpen: true }); },
  close: () => { set({ isOpen: false, proposal: null }); },
}));
