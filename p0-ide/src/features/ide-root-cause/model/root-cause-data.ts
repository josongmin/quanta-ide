export interface TraceStep {
  id: string;
  file: string;
  line: number;
  symbol: string;
  kind: "entry" | "propagation" | "root";
  summary: string;
}

export interface RootCauseTrace {
  errorId: string;
  errorTitle: string;
  severity: "P0" | "P1" | "P2";
  confidence: "high" | "medium" | "low";
  rootSymbol: string;
  rootFile: string;
  rootLine: number;
  explanation: string;
  trace: TraceStep[];
}

export const SAMPLE_TRACE: RootCauseTrace = {
  errorId: "INC-2024-0312",
  errorTitle: "Double refund via retry loop",
  severity: "P0",
  confidence: "high",
  rootSymbol: "processRefund",
  rootFile: "orchestrator.py",
  rootLine: 315,
  explanation: "Retry loop at L:318 re-invokes processRefund without idempotency check. When upstream returns a transient 503, the loop fires 3 times, each creating a refund entry.",
  trace: [
    { id: "t1", file: "api/handler.py", line: 42, symbol: "handleRefundRequest", kind: "entry", summary: "HTTP POST /refund received" },
    { id: "t2", file: "orchestrator.py", line: 315, symbol: "processRefund", kind: "propagation", summary: "Dispatches to payment gateway" },
    { id: "t3", file: "orchestrator.py", line: 318, symbol: "retryLoop", kind: "root", summary: "Retry without idempotency key — root cause" },
    { id: "t4", file: "gateway/client.py", line: 88, symbol: "chargeGateway", kind: "propagation", summary: "3× charge sent to Stripe" },
    { id: "t5", file: "ledger.ts", line: 201, symbol: "postEntry", kind: "propagation", summary: "3 ledger entries created" },
  ],
};
