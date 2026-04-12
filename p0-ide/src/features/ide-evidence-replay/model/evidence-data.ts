export type ReplayStatus = "idle" | "running" | "passed" | "failed";

export interface EvidenceItem {
  id: string;
  label: string;
  loc?: string;
  verified: boolean;
}

export interface ReplayStep {
  id: string;
  label: string;
  status: ReplayStatus;
  durationMs?: number;
}

export interface EvidenceReplayData {
  changeId: string;
  title: string;
  evidence: EvidenceItem[];
  replay: ReplayStep[];
}

export const SAMPLE_EVIDENCE: EvidenceReplayData = {
  changeId: "CHG-0042",
  title: "Add idempotency key to retry loop",
  evidence: [
    { id: "e1", label: "Taint path resolved", loc: "refund.ts:6 → refund.ts:10", verified: true },
    { id: "e2", label: "sanitizeAmount() called before write", loc: "lib/validation.ts:23", verified: true },
    { id: "e3", label: "Idempotency key checked in retry", loc: "orchestrator.py:318", verified: true },
    { id: "e4", label: "No new side effects introduced", verified: true },
    { id: "e5", label: "Regression test added", loc: "test/refund.test.ts:88", verified: false },
  ],
  replay: [
    { id: "r1", label: "Build project", status: "passed", durationMs: 2400 },
    { id: "r2", label: "Run affected tests (12)", status: "passed", durationMs: 8200 },
    { id: "r3", label: "Taint analysis", status: "passed", durationMs: 1100 },
    { id: "r4", label: "Blast radius diff (before → after)", status: "passed", durationMs: 600 },
    { id: "r5", label: "Behavior equivalence check", status: "passed", durationMs: 3200 },
  ],
};
