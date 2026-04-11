import type { FileNode } from "@/widgets/ide-files";
import type { CallNode } from "@/features/ide-call-graph";
import type { FlowStep } from "@/features/ide-data-flow";
import type { Metric } from "@/features/ide-metrics";
import type { Pill } from "@/features/ide-pills";

export const MOCK_FILES: FileNode[] = [
  { name: "codegraph_agent", type: "folder", depth: 0, open: true },
  { name: "orchestrator", type: "folder", depth: 1, open: true, issues: 4, risk: 4 },
  { name: "orchestrator.py", type: "file", depth: 2, active: true, issues: 3, risk: 4, git: "M", tests: "0/12", callers: 12, churn: 8 },
  { name: "routing_policy.py", type: "file", depth: 2, issues: 1, risk: 2, git: "M", tests: "1/9", callers: 9, stale: "3mo" },
  { name: "tools", type: "folder", depth: 1, open: true, issues: 2, risk: 3 },
  { name: "plan_orchestration", type: "folder", depth: 2, open: true },
  { name: "security.py", type: "file", depth: 3, issues: 1, risk: 3, git: "A", tests: "2/7", callers: 7 },
  { name: "base.py", type: "file", depth: 3, tests: "✓", stale: "5mo" },
  { name: "infrastructure", type: "folder", depth: 1, open: false },
  { name: "audit", type: "folder", depth: 2, open: false },
  { name: "audit_store.py", type: "file", depth: 3, tests: "✓", callers: 5 },
  { name: "domain", type: "folder", depth: 1, open: false },
  { name: "shared", type: "folder", depth: 1, open: false },
  { name: "pyproject.toml", type: "file", depth: 0, stale: "2mo" },
];

export const MOCK_METRICS: Metric[] = [
  { key: "cpx", v: "9.1" },
  { key: "tests", v: "0", delta: "/12" },
  { key: "callers", v: "12" },
  { key: "blast", v: "38" },
];

export const MOCK_PILLS: Pill[] = [
  { pillKey: "refund.taintSource", risk: 3 },
  { pillKey: "refund.noTests", risk: 2 },
  { pillKey: "refund.hotPath", risk: "hot" },
  { pillKey: "refund.callers", pillParams: { count: 12 }, risk: 1 },
];

export const MOCK_CALL_GRAPH: CallNode[] = [
  { name: "execute", depth: 0 },
  { name: "_decide_reasoning_path", depth: 1 },
  { name: "_select_strategy", depth: 1 },
  { name: "experience_store.save", depth: 1, tag: "write" },
  { name: "_run_beam_strategy", depth: 2 },
  { name: "_run_o1_strategy", depth: 2, isLast: true },
];

export const MOCK_DATA_FLOW: FlowStep[] = [
  { group: "orchestrator", step: "request.task", tag: "source" },
  { group: "orchestrator", step: "_decide_reasoning_path" },
  { group: "orchestrator", step: "_select_strategy" },
  { group: "orchestrator", step: "experience_store.save", tag: "sink", sink: true },
];
