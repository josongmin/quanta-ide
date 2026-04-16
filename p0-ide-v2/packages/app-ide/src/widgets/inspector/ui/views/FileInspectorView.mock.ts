import {
  IconComplexity,
  IconDead,
  IconNoTests,
  IconTaint,
} from "@quanta/ui-kit/ui/icons";
import type { SuggestionData } from "./SuggestionOverlay";

export const signals = [
  { kind: "danger", Icon: IconTaint, label: "Taint sink", detail: "experience_store.save — unguarded" },
  { kind: "warn", Icon: IconNoTests, label: "No tests", detail: "execute() has 0/12 tests" },
  { kind: "warn", Icon: IconComplexity, label: "High complexity", detail: "CPX 9 (threshold 8)" },
  { kind: "muted", Icon: IconDead, label: "Dead code", detail: "_select_strategy — unreferenced" },
];

// ── Topic ⑤-a · Spec mining: implicit rules discovered across codebase ─
export const specRules: {
  id: string;
  rule: string;
  confidence: number;
  instances: number;
  violation?: { symbol: string; loc: string; reason: string };
}[] = [
  {
    id: "sr-01",
    rule: "*Orchestrator.execute() must call validate_trace() before _store.save()",
    confidence: 0.94,
    instances: 12,
    violation: { symbol: "DeepReasoningOrchestrator.execute", loc: "orchestrator.py:16", reason: "save reached without validator on path" },
  },
  {
    id: "sr-02",
    rule: "Taint-source parameters carry Tainted[T] annotation",
    confidence: 0.88,
    instances: 18,
  },
  {
    id: "sr-03",
    rule: "ExperienceStore writes emit audit.emit() within same frame",
    confidence: 0.82,
    instances: 7,
  },
];

// ── Topic ⑤-b · AI contribution heatmap ────────────────────────────────
export const aiContribution = {
  aiRatio: 0.73,
  reviewedRatio: 0.12,
  aiLines: 147,
  reviewedLines: 18,
  humanLines: 54,
  authors: [
    { name: "quanta-agent", lines: 98, ratio: 0.49, kind: "ai"    as const },
    { name: "copilot",      lines: 49, ratio: 0.24, kind: "ai"    as const },
    { name: "@songmin",     lines: 54, ratio: 0.27, kind: "human" as const },
  ],
  bands: [
    { start: 1,   end: 47,  aiRatio: 0.92, reviewed: 0.05 },
    { start: 48,  end: 102, aiRatio: 0.58, reviewed: 0.30 },
    { start: 103, end: 148, aiRatio: 0.71, reviewed: 0.08 },
    { start: 149, end: 200, aiRatio: 0.41, reviewed: 0.55 },
  ],
};

export const coverage = { pct: 0, uncovered: 8, files: 1 };
export const coverageRows: { file: string; covered: number; total: number; delta: number }[] = [
  { file: "orchestrator.py", covered: 0, total: 8, delta: -8 },
];

export type DeadConf = "high" | "med";
export const deadCode: { kind: "fn" | "class" | "const"; name: string; loc: string; conf: DeadConf; strike?: boolean }[] = [
  { kind: "fn", name: "_legacy_inference_bridge", loc: "orchestrator.py:147", conf: "high", strike: true },
  { kind: "class", name: "OldRetryPolicy", loc: "orchestrator.py:153", conf: "high" },
  { kind: "const", name: "TEMP_FEATURE_FLAG", loc: "orchestrator.py:159", conf: "high", strike: true },
];

export type ChurnTrend = "up" | "flat" | "down";
export const churn: { file: string; trend: ChurnTrend; count: number; weight: number; spark: number[] }[] = [
  { file: "orchestrator.py", trend: "up", count: 28, weight: 1.0, spark: [4, 6, 5, 9, 12, 18, 28] },
  { file: "fee.py", trend: "up", count: 22, weight: 0.78, spark: [2, 3, 5, 7, 11, 15, 22] },
  { file: "security.py", trend: "up", count: 19, weight: 0.68, spark: [3, 4, 4, 6, 9, 14, 19] },
  { file: "webhook.py", trend: "flat", count: 18, weight: 0.65, spark: [12, 13, 12, 14, 13, 17, 18] },
  { file: "retry.py", trend: "flat", count: 15, weight: 0.55, spark: [10, 12, 11, 13, 14, 14, 15] },
  { file: "routing_policy.py", trend: "flat", count: 14, weight: 0.5, spark: [9, 11, 12, 11, 13, 13, 14] },
  { file: "ledger.py", trend: "down", count: 12, weight: 0.45, spark: [22, 19, 18, 16, 14, 12, 12] },
  { file: "billing.py", trend: "down", count: 9, weight: 0.32, spark: [18, 15, 13, 12, 11, 10, 9] },
  { file: "audit_store.py", trend: "down", count: 3, weight: 0.12, spark: [14, 11, 9, 7, 5, 4, 3] },
];

export const suggestion: SuggestionData = {
  title: "Guard taint sink with trace validator",
  rationale:
    "Insert validate_trace() at the single chokepoint where external traces enter the persistence layer. Closes both open paths with one guard — no public API change, no new dependencies.",
  diff: `+ if not trace.validated():
+     raise UnvalidatedTrace()
  self._store.save(trace)`,
  riskBefore: 78,
  riskAfter: 12,
  verification: [
    { state: "pass", label: "Closes 2 open taint paths",        value: "2 → 0",   engine: "taint v2" },
    { state: "pass", label: "Blast radius shrinks",             value: "17 → 2",  engine: "blast" },
    { state: "pass", label: "No public API break",                                engine: "behavior diff" },
    { state: "pass", label: "No new type errors",               value: "0",       engine: "type check" },
    { state: "pass", label: "Behavior identical on valid input",                  engine: "behavior diff" },
    { state: "warn", label: "3 regression tests recommended",   value: "+3",      engine: "coverage" },
    { state: "info", label: "Affects 5 call sites",             value: "5",       engine: "call graph" },
  ],
  confidence: 0.92,
  counterfactual: {
    riskWithout: 78,
    costDays: 3.5,
    items: [
      { state: "danger", label: "2 taint paths remain open",            engine: "taint v2",     detail: "request.ctx → step.run → trace → save (unvalidated)" },
      { state: "danger", label: "2 external sources stay exposed",      engine: "source-map",   detail: "webhook.receive · http_controller.handle" },
      { state: "warn",   label: "INC-412 likely within ~2 weeks",       engine: "incident DNA", detail: "91% shape match · past median time-to-fire 11d" },
      { state: "warn",   label: "17 downstream symbols inherit risk",   engine: "blast",        detail: "3 on critical reasoning path" },
    ],
  },
  proofReplay: {
    status: "pending",
    checks: [
      { label: "Behavior diff against 12 sampled inputs",        pass: true,  engine: "behavior diff", sample: "12 samples" },
      { label: "Blast radius recompute post-apply",              pass: true,  engine: "blast" },
      { label: "Type-check affected files",                       pass: true,  engine: "type check",     sample: "47 files" },
      { label: "Arch-rule scan on infra → domain boundary",      pass: true,  engine: "arch rules" },
    ],
  },
  patchTrail: [
    { id: "p-14", when: "2h",   action: "applied",   title: "Reduce _select_strategy complexity",       riskBefore: 24, riskAfter: 14, author: "quanta-agent" },
    { id: "p-09", when: "1d",   action: "dismissed", title: "Add retry-on-429 to fetch_trace",          riskBefore: 31, riskAfter: 18, reason: "behavior diff detected subtle timeout drift" },
    { id: "p-03", when: "3d",   action: "applied",   title: "Extract validate_trace helper",            riskBefore: 42, riskAfter: 24, author: "quanta-agent" },
  ],
};
