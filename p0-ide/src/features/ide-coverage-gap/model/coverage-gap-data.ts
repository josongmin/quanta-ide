export interface UncoveredSymbol {
  name: string;
  kind: "function" | "method" | "class";
  line: number;
  risk: 1 | 2 | 3 | 4;
}

export interface CoverageGapFile {
  id: string;
  file: string;
  covered: number;
  total: number;
  uncovered: UncoveredSymbol[];
}

export const COVERAGE_GAPS: CoverageGapFile[] = [
  {
    id: "cg1", file: "fee.ts", covered: 4, total: 7,
    uncovered: [
      { name: "calculateFee", kind: "function", line: 42, risk: 4 },
      { name: "validateFeeRule", kind: "function", line: 88, risk: 3 },
      { name: "applyDiscount", kind: "function", line: 134, risk: 3 },
    ],
  },
  {
    id: "cg2", file: "webhook.ts", covered: 2, total: 5,
    uncovered: [
      { name: "dispatchWebhook", kind: "function", line: 31, risk: 4 },
      { name: "verifySignature", kind: "function", line: 78, risk: 4 },
      { name: "retryDelivery", kind: "function", line: 120, risk: 3 },
    ],
  },
  {
    id: "cg3", file: "ledger.ts", covered: 6, total: 8,
    uncovered: [
      { name: "reconcile", kind: "function", line: 201, risk: 3 },
      { name: "rollbackEntry", kind: "function", line: 245, risk: 3 },
    ],
  },
  {
    id: "cg4", file: "billing.ts", covered: 3, total: 4,
    uncovered: [
      { name: "chargeCycle", kind: "function", line: 55, risk: 3 },
    ],
  },
  {
    id: "cg5", file: "retry.ts", covered: 5, total: 6,
    uncovered: [
      { name: "backoff", kind: "function", line: 67, risk: 2 },
    ],
  },
];
