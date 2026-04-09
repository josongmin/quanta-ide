// Per-file metadata for the File Inspector view

export interface FileSymbol {
  name: string;
  kind: "function" | "class" | "const" | "type";
  loc: string;
  riskScore: number;
  cpx?: string;
  callers?: number;
  tests?: string;
  taint?: "source" | "sink" | "passthrough";
  dead?: boolean;
}

/** A signal = one actionable risk finding at the file level */
export interface FileSignal {
  kind: "no-tests" | "taint-sink" | "taint-source" | "dead-code" | "bus-factor" | "high-cpx" | "blast";
  message: string;
  severity: 1 | 2 | 3; // 1=info, 2=warn, 3=critical
  /** symbol name this signal points at, if any */
  symbol?: string;
}

/** One row in the function heatmap (line-density viz) */
export interface HeatRow {
  name: string;
  loc: string;   // line number string
  risk: number;  // 0-100
  cpx: number;
  dead?: boolean;
}

/** A file that imports / is affected by this file */
export interface BlastNeighbor {
  name: string;
  risk: number;
  relation: "imports-us" | "we-import";
}

export interface FileInspectorData {
  fileName: string;
  loc: number;
  functions: number;
  lastModified: string;
  author: string;
  busFactor: number;
  riskScore: number;
  blastTotal: number;
  taintPaths: number;
  deadCode: number;
  symbols: FileSymbol[];
  owners: { name: string; coverage: number }[];
  /** Risk signals — shown as the first thing after the header */
  signals: FileSignal[];
  /** Function heatmap rows */
  heatRows: HeatRow[];
  /** Top connected files */
  blastNeighbors: BlastNeighbor[];
}

export const FILE_INSPECTOR: Record<string, FileInspectorData> = {
  "refund.ts": {
    fileName: "refund.ts",
    loc: 247,
    functions: 6,
    lastModified: "2h ago",
    author: "alice",
    busFactor: 1,
    riskScore: 78,
    blastTotal: 31,
    taintPaths: 3,
    deadCode: 1,
    signals: [
      { kind: "no-tests",    severity: 3, message: "0 of 14 callers have tests", symbol: "processRefund" },
      { kind: "taint-sink",  severity: 3, message: "User input reaches db.update unvalidated", symbol: "processRefund" },
      { kind: "taint-source",severity: 2, message: "req.body.amount is a taint source", symbol: "processRefund" },
      { kind: "dead-code",   severity: 1, message: "sendWebhook — last ref removed 6mo ago", symbol: "sendWebhook" },
      { kind: "bus-factor",  severity: 2, message: "Only alice has >50% ownership" },
    ],
    heatRows: [
      { name: "processRefund",  loc: "5",  risk: 78, cpx: 8.2 },
      { name: "validateAmount", loc: "34", risk: 42, cpx: 3.1 },
      { name: "buildTx",        loc: "58", risk: 31, cpx: 2.4 },
      { name: "sendWebhook",    loc: "89", risk: 0,  cpx: 1.2, dead: true },
    ],
    blastNeighbors: [
      { name: "charge.ts",    risk: 52, relation: "imports-us" },
      { name: "ledger.ts",    risk: 23, relation: "we-import" },
      { name: "webhooks/notify.ts", risk: 61, relation: "imports-us" },
    ],
    symbols: [
      { name: "processRefund", kind: "function", loc: "5",  riskScore: 78, cpx: "8.2", callers: 14, tests: "0/14", taint: "sink" },
      { name: "validateAmount",kind: "function", loc: "34", riskScore: 42, cpx: "3.1", callers: 3,  tests: "2/3" },
      { name: "buildTx",       kind: "function", loc: "58", riskScore: 31, cpx: "2.4", callers: 2,  tests: "1/2" },
      { name: "sendWebhook",   kind: "function", loc: "89", riskScore: 0,  cpx: "1.2", callers: 0,  dead: true },
      { name: "MAX_REFUND",    kind: "const",    loc: "3",  riskScore: 0 },
      { name: "RefundResult",  kind: "type",     loc: "12", riskScore: 0 },
    ],
    owners: [
      { name: "alice", coverage: 74 },
      { name: "bob",   coverage: 26 },
    ],
  },
  "charge.ts": {
    fileName: "charge.ts",
    loc: 183,
    functions: 5,
    lastModified: "1d ago",
    author: "bob",
    busFactor: 2,
    riskScore: 52,
    blastTotal: 18,
    taintPaths: 1,
    deadCode: 0,
    signals: [
      { kind: "taint-sink",  severity: 2, message: "Card data flows to authorize() without masking", symbol: "processCharge" },
      { kind: "no-tests",    severity: 2, message: "3 of 9 callers covered — 6 untested", symbol: "processCharge" },
      { kind: "high-cpx",    severity: 1, message: "authorize() CPX 4.1 — above threshold", symbol: "authorize" },
    ],
    heatRows: [
      { name: "processCharge", loc: "5",  risk: 52, cpx: 5.4 },
      { name: "validateCard",  loc: "38", risk: 28, cpx: 2.8 },
      { name: "authorize",     loc: "67", risk: 45, cpx: 4.1 },
      { name: "capture",       loc: "94", risk: 33, cpx: 2.9 },
    ],
    blastNeighbors: [
      { name: "refund.ts",     risk: 78, relation: "we-import" },
      { name: "orders/pay.ts", risk: 44, relation: "imports-us" },
      { name: "ledger.ts",     risk: 23, relation: "we-import" },
    ],
    symbols: [
      { name: "processCharge", kind: "function", loc: "5",  riskScore: 52, cpx: "5.4", callers: 9, tests: "3/9", taint: "sink" },
      { name: "validateCard",  kind: "function", loc: "38", riskScore: 28, cpx: "2.8", callers: 4, tests: "3/4" },
      { name: "authorize",     kind: "function", loc: "67", riskScore: 45, cpx: "4.1", callers: 6, tests: "2/6" },
      { name: "capture",       kind: "function", loc: "94", riskScore: 33, cpx: "2.9", callers: 3, tests: "2/3" },
      { name: "ChargeResult",  kind: "type",     loc: "3",  riskScore: 0 },
    ],
    owners: [
      { name: "bob",   coverage: 58 },
      { name: "carol", coverage: 42 },
    ],
  },
  "ledger.ts": {
    fileName: "ledger.ts",
    loc: 98,
    functions: 3,
    lastModified: "5d ago",
    author: "carol",
    busFactor: 2,
    riskScore: 23,
    blastTotal: 5,
    taintPaths: 0,
    deadCode: 0,
    signals: [
      { kind: "blast", severity: 1, message: "Imported by 5 files — changes have wide reach" },
    ],
    heatRows: [
      { name: "appendLedger", loc: "4",  risk: 23, cpx: 2.1 },
      { name: "readLedger",   loc: "28", risk: 12, cpx: 1.4 },
    ],
    blastNeighbors: [
      { name: "refund.ts",  risk: 78, relation: "imports-us" },
      { name: "charge.ts",  risk: 52, relation: "imports-us" },
      { name: "audit/log.ts", risk: 18, relation: "imports-us" },
    ],
    symbols: [
      { name: "appendLedger", kind: "function", loc: "4",  riskScore: 23, cpx: "2.1", callers: 3, tests: "7/7" },
      { name: "readLedger",   kind: "function", loc: "28", riskScore: 12, cpx: "1.4", callers: 5, tests: "4/4" },
      { name: "LedgerEntry",  kind: "type",     loc: "1",  riskScore: 0 },
    ],
    owners: [
      { name: "carol", coverage: 85 },
      { name: "alice", coverage: 15 },
    ],
  },
};
