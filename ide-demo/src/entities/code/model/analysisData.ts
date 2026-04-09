export interface LineAnnotation {
  line: number;
  type: "taint-source" | "taint-sink" | "callers" | "blast-radius" | "cve" | "dead-code" | "unsafe-write";
  label: string;
  severity: "critical" | "warning" | "info";
}

export interface FunctionMeta {
  name: string;
  startLine: number;
  endLine: number;
  complexity: number;
  tested: boolean;
  hotspot: boolean;
  blastRadius: number;
  taintPaths: number;
  callers: number;
}

export interface TaintPath {
  id: string;
  sourceLine: number;
  sinkLine: number;
  sourceLabel: string;
  sinkLabel: string;
  hops: number[];
}

export interface CallGraphNode {
  name: string;
  status: "tested" | "taint" | "dead" | "normal" | "untested";
  children?: CallGraphNode[];
  filePath?: string;
  line?: number;
}

/** Per-file analysis annotations for processRefund.ts */
export const LINE_ANNOTATIONS: Record<string, LineAnnotation[]> = {
  "src/payment/processRefund.ts": [
    { line: 1, type: "cve", label: "+42kb  CVE-2025-30066 CRITICAL", severity: "critical" },
    { line: 19, type: "taint-source", label: "taint source — user input", severity: "critical" },
    { line: 33, type: "unsafe-write", label: "DB write — no sanitizer", severity: "critical" },
    { line: 34, type: "callers", label: "14 callers affected", severity: "warning" },
    { line: 40, type: "unsafe-write", label: "DB write — state mutation", severity: "warning" },
    { line: 43, type: "callers", label: "ledger.write — 7 callers", severity: "info" },
    { line: 49, type: "dead-code", label: "sendWebhook — 0 active consumers", severity: "info" },
    { line: 56, type: "blast-radius", label: "blast radius: 31 files", severity: "critical" },
  ],
  "src/auth/validate.ts": [
    { line: 12, type: "callers", label: "23 callers", severity: "info" },
    { line: 14, type: "taint-source", label: "cache — unsanitized return", severity: "warning" },
  ],
};

export const FUNCTION_META: Record<string, FunctionMeta[]> = {
  "src/payment/processRefund.ts": [
    { name: "processRefund", startLine: 17, endLine: 56, complexity: 8.2, tested: false, hotspot: true, blastRadius: 31, taintPaths: 2, callers: 14 },
  ],
  "src/auth/validate.ts": [
    { name: "validateUser", startLine: 11, endLine: 19, complexity: 3.1, tested: true, hotspot: false, blastRadius: 8, taintPaths: 0, callers: 23 },
  ],
};

export const TAINT_PATHS: Record<string, TaintPath[]> = {
  "src/payment/processRefund.ts": [
    { id: "tp-1", sourceLine: 19, sinkLine: 40, sourceLabel: "req.body.amount", sinkLabel: "db.orders.update", hops: [19, 33, 34, 40] },
    { id: "tp-2", sourceLine: 19, sinkLine: 43, sourceLabel: "req.body.amount", sinkLabel: "ledger.write", hops: [19, 43] },
  ],
};

export const CALL_GRAPH: Record<string, CallGraphNode> = {
  processRefund: {
    name: "processRefund",
    status: "taint",
    filePath: "src/payment/processRefund.ts",
    line: 17,
    children: [
      {
        name: "validateUser",
        status: "tested",
        filePath: "src/auth/validate.ts",
        line: 11,
        children: [
          { name: "db.users.findUnique", status: "normal", line: 15 },
          { name: "cache.get", status: "normal", line: 12 },
        ],
      },
      {
        name: "db.orders.findUnique",
        status: "normal",
        line: 28,
      },
      {
        name: "db.transactions.create",
        status: "taint",
        line: 33,
        children: [
          { name: "prisma.create", status: "normal" },
        ],
      },
      {
        name: "db.orders.update",
        status: "taint",
        line: 40,
        children: [
          { name: "prisma.update", status: "normal" },
        ],
      },
      {
        name: "ledger.write",
        status: "untested",
        filePath: "src/billing/ledger.ts",
        line: 43,
      },
      {
        name: "sendWebhook",
        status: "dead",
        filePath: "src/webhooks/sender.ts",
        line: 49,
      },
    ],
  },
};

export const SYSTEM_RISK = {
  score: 72,
  taintPaths: 5,
  unsafeWrites: 12,
  affectedFiles: 31,
  deadCodePercent: 12,
  techDebtTrend: +12,
};
