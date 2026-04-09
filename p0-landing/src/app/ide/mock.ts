import type { FileNode } from "@/widgets/ide-files";
import type { CallNode } from "@/features/ide-call-graph";
import type { FlowStep } from "@/features/ide-data-flow";
import type { Metric } from "@/features/ide-metrics";
import type { Pill } from "@/features/ide-pills";

export const MOCK_FILES: FileNode[] = [
  { name: "src", type: "folder", depth: 0, open: true },
  { name: "payments", type: "folder", depth: 1, open: true, issues: 4, risk: 3 },
  { name: "refund.ts", type: "file", depth: 2, active: true, issues: 2, risk: 4 },
  { name: "charge.ts", type: "file", depth: 2, issues: 1, risk: 2 },
  { name: "ledger.ts", type: "file", depth: 2 },
  { name: "auth", type: "folder", depth: 1, open: false, issues: 1, risk: 2 },
  { name: "orders", type: "folder", depth: 1, open: false },
  { name: "webhooks", type: "folder", depth: 1, open: false, issues: 1, risk: 1 },
  { name: "lib", type: "folder", depth: 1, open: false },
  { name: "package.json", type: "file", depth: 0 },
  { name: "tsconfig.json", type: "file", depth: 0 },
];

export const MOCK_METRICS: Metric[] = [
  { k: "Cpx", v: "8.2" },
  { k: "Tests", v: "0", delta: "/14" },
  { k: "Callers", v: "14" },
  { k: "Blast", v: "31" },
];

export const MOCK_PILLS: Pill[] = [
  { label: "taint source", risk: 3 },
  { label: "no tests", risk: 2 },
  { label: "hot path", risk: "hot" },
  { label: "14 callers", risk: 1 },
];

export const MOCK_CALL_GRAPH: CallNode[] = [
  { name: "processRefund", depth: 0 },
  { name: "validateUser", depth: 1, tag: "tested" },
  { name: "buildTransaction", depth: 1 },
  { name: "db.update", depth: 1, tag: "unsafe" },
  { name: "ledger.write", depth: 2, isLast: true },
  { name: "sendWebhook", depth: 1, tag: "dead", isLast: true },
];

export const MOCK_DATA_FLOW: FlowStep[] = [
  { label: "req.body.amount", tag: "source" },
  { label: "parse(amount)" },
  { label: "build(validated)" },
  { label: "db.update({ amount })", tag: "sink", sink: true },
];
