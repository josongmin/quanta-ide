import type {
  BenchRun,
  CapabilityScore,
  GoldenTask,
  TaskResult,
} from "../model/types";

/* ═══════════════════════════════════════════════════════════════
   orchestrator.py — 14 tasks across 7 capabilities
   11 pass · 2 fail · 1 flaky · overall ~78%
   "behavior" capability regressed by 1 vs last green run
   ═══════════════════════════════════════════════════════════════ */

const orchestratorTasks: GoldenTask[] = [
  { id: "o-t1",  capability: "taint",           description: "untrusted req.body.q reaches db.exec sink",          fileName: "orchestrator.py", expectedSummary: "src=req.body.q → sink=db.exec via plan.args[2]" },
  { id: "o-t2",  capability: "taint",           description: "user-id never reaches log sink",                     fileName: "orchestrator.py", expectedSummary: "no path from req.user → audit.write" },
  { id: "o-t3",  capability: "taint",           description: "policy ctx tainted on bypass branch",                fileName: "orchestrator.py", expectedSummary: "ctx flagged when legacy_bypass_flag=true" },
  { id: "o-b1",  capability: "blast",           description: "blast radius for dispatch()",                        fileName: "orchestrator.py", expectedSummary: "['executor.py', 'planner.py']" },
  { id: "o-b2",  capability: "blast",           description: "blast radius for build_plan()",                      fileName: "orchestrator.py", expectedSummary: "['planner.py', 'apply_policy']" },
  { id: "o-b3",  capability: "blast",           description: "blast radius for apply_policy()",                    fileName: "orchestrator.py", expectedSummary: "['policy_registry', 'routing_policy.py']" },
  { id: "o-bh1", capability: "behavior",        description: "behavior diff: dispatch on null user",               fileName: "orchestrator.py", expectedSummary: "raises NoUser; previously returned 500" },
  { id: "o-bh2", capability: "behavior",        description: "behavior diff: cache_hit branch flip",               fileName: "orchestrator.py", expectedSummary: "DB query now skipped on cache hit" },
  { id: "o-rf1", capability: "refactor",        description: "extract resolve_user is safe",                       fileName: "orchestrator.py", expectedSummary: "no semantic change; 3 callers updated" },
  { id: "o-rf2", capability: "refactor",        description: "rename build_plan → compose_plan",                   fileName: "orchestrator.py", expectedSummary: "5 references rewritten across 4 files" },
  { id: "o-fl1", capability: "flow",            description: "request flow: HTTP → dispatch → execute",            fileName: "orchestrator.py", expectedSummary: "4-hop sync chain through resolve_user/build_plan" },
  { id: "o-fl2", capability: "flow",            description: "async resume after policy.evaluate",                 fileName: "orchestrator.py", expectedSummary: "await resumes at line 110, ~220ms" },
  { id: "o-rc1", capability: "race",            description: "user_cache write contended by build_plan path",      fileName: "orchestrator.py", expectedSummary: "race window between line 55 and line 96" },
  { id: "o-ir1", capability: "incident-replay", description: "replay reconstructs TaintFlowError at L142",         fileName: "orchestrator.py", expectedSummary: "30 events, exception at t=1500ms" },
];

const orchestratorResults: TaskResult[] = [
  { taskId: "o-t1",  outcome: "pass",  latencyMs:  82, detail: "matched expected source/sink path",                                                stability30d: 1.0  },
  { taskId: "o-t2",  outcome: "pass",  latencyMs:  41, detail: "no false-positive paths emitted",                                                  stability30d: 1.0  },
  { taskId: "o-t3",  outcome: "flaky", latencyMs: 118, detail: "flagged 27/30 recent runs; ordering of bypass branch evaluation non-deterministic", stability30d: 0.90 },
  { taskId: "o-b1",  outcome: "pass",  latencyMs:  64, detail: "blast = ['executor.py', 'planner.py']",                                            stability30d: 1.0  },
  { taskId: "o-b2",  outcome: "pass",  latencyMs:  71, detail: "matched 2 expected targets",                                                       stability30d: 1.0  },
  { taskId: "o-b3",  outcome: "pass",  latencyMs:  88, detail: "matched 2 expected targets",                                                       stability30d: 1.0  },
  { taskId: "o-bh1", outcome: "fail",  latencyMs: 142, detail: "expected: raises NoUser\nactual:   returns 500 with stale plan",                  stability30d: 0.42 },
  { taskId: "o-bh2", outcome: "pass",  latencyMs:  96, detail: "branch flip detected, DB skip confirmed",                                          stability30d: 1.0  },
  { taskId: "o-rf1", outcome: "pass",  latencyMs: 134, detail: "extract preserves 12 control-flow invariants",                                     stability30d: 1.0  },
  { taskId: "o-rf2", outcome: "pass",  latencyMs: 104, detail: "5 references rewritten, no leftover symbols",                                      stability30d: 1.0  },
  { taskId: "o-fl1", outcome: "pass",  latencyMs:  53, detail: "4-hop chain matched",                                                              stability30d: 1.0  },
  { taskId: "o-fl2", outcome: "fail",  latencyMs: 167, detail: "expected resume at L110 ±20ms\nactual:   resume at L110, +260ms (drift)",         stability30d: 0.55 },
  { taskId: "o-rc1", outcome: "pass",  latencyMs: 121, detail: "race window detected (L55 ↔ L96)",                                                stability30d: 1.0  },
  { taskId: "o-ir1", outcome: "pass",  latencyMs: 198, detail: "30 events, exception at t=1500ms — within tolerance",                              stability30d: 1.0  },
];

const orchestratorCapabilityScores: CapabilityScore[] = [
  { capability: "taint",           passCount: 2, total: 3, scorePct:  67, p50Ms:  82, p95Ms: 118, trend: [55, 60, 60, 67, 67, 60, 67, 67, 70, 67], deltaFromLastGreen:  0 },
  { capability: "blast",           passCount: 3, total: 3, scorePct: 100, p50Ms:  71, p95Ms:  88, trend: [80, 80, 90, 90, 90, 95, 95, 95, 95, 100], deltaFromLastGreen: +1 },
  { capability: "behavior",        passCount: 1, total: 2, scorePct:  50, p50Ms: 119, p95Ms: 142, trend: [80, 80, 90, 90, 90, 90, 90, 80, 70, 50], deltaFromLastGreen: -1 },
  { capability: "refactor",        passCount: 2, total: 2, scorePct: 100, p50Ms: 119, p95Ms: 134, trend: [70, 80, 85, 90, 90, 95, 95, 100, 100, 100], deltaFromLastGreen:  0 },
  { capability: "flow",            passCount: 1, total: 2, scorePct:  50, p50Ms: 110, p95Ms: 167, trend: [70, 80, 85, 85, 85, 80, 70, 60, 55, 50], deltaFromLastGreen:  0 },
  { capability: "race",            passCount: 1, total: 1, scorePct: 100, p50Ms: 121, p95Ms: 121, trend: [60, 60, 80, 80, 100, 100, 100, 100, 100, 100], deltaFromLastGreen:  0 },
  { capability: "incident-replay", passCount: 1, total: 1, scorePct: 100, p50Ms: 198, p95Ms: 198, trend: [70, 75, 80, 90, 95, 95, 100, 100, 100, 100], deltaFromLastGreen:  0 },
];

const orchestratorRun: BenchRun = {
  runId: "bench-2026-04-24-orch-r418",
  startedAt: "2026-04-24T08:14:02Z",
  durationMs: 1554,
  tasks: orchestratorTasks,
  results: orchestratorResults,
  capabilityScores: orchestratorCapabilityScores,
  regressedTaskIds: ["o-bh1"],
  flakyTaskIds: ["o-t3"],
  overallScorePct: 78,
  lastGreenAt: "2026-04-20T08:11:50Z",
};

/* ═══════════════════════════════════════════════════════════════
   routing_policy.py — 6 tasks · 5 pass + 1 flaky · score 100% solid
   ═══════════════════════════════════════════════════════════════ */

const routingTasks: GoldenTask[] = [
  { id: "r-fl1", capability: "flow",     description: "match() rule scoring fan-out",        fileName: "routing_policy.py", expectedSummary: "14 rules evaluated, top-1 returned" },
  { id: "r-fl2", capability: "flow",     description: "geoip await/resume duration",         fileName: "routing_policy.py", expectedSummary: "await resumes at L29, ~340ms" },
  { id: "r-bh1", capability: "behavior", description: "behavior diff on threshold tweak",    fileName: "routing_policy.py", expectedSummary: "no rule re-ranking under +0.05 delta" },
  { id: "r-rf1", capability: "refactor", description: "rename score_rule → rank_rule",       fileName: "routing_policy.py", expectedSummary: "3 references rewritten" },
  { id: "r-b1",  capability: "blast",    description: "blast radius for match()",            fileName: "routing_policy.py", expectedSummary: "['orchestrator.py']" },
  { id: "r-ti1", capability: "test-intel", description: "PR-gate suite covers match()",      fileName: "routing_policy.py", expectedSummary: "≥3 selected tests cover L17, L41, L56" },
];

const routingResults: TaskResult[] = [
  { taskId: "r-fl1", outcome: "pass",  latencyMs:  44, detail: "14 rules, top-1 matched",                                              stability30d: 1.0  },
  { taskId: "r-fl2", outcome: "flaky", latencyMs:  92, detail: "geoip latency variance 280-380ms; 28/30 recent runs within tolerance", stability30d: 0.93 },
  { taskId: "r-bh1", outcome: "pass",  latencyMs:  76, detail: "no re-ranking under threshold delta",                                  stability30d: 1.0  },
  { taskId: "r-rf1", outcome: "pass",  latencyMs:  68, detail: "3 references rewritten, no leftover symbols",                          stability30d: 1.0  },
  { taskId: "r-b1",  outcome: "pass",  latencyMs:  39, detail: "blast = ['orchestrator.py']",                                          stability30d: 1.0  },
  { taskId: "r-ti1", outcome: "pass",  latencyMs:  58, detail: "3 tests selected, all critical lines covered",                         stability30d: 1.0  },
];

const routingCapabilityScores: CapabilityScore[] = [
  { capability: "flow",       passCount: 1, total: 2, scorePct:  50, p50Ms: 68, p95Ms:  92, trend: [60, 70, 80, 80, 90, 90, 90, 90, 90, 50], deltaFromLastGreen:  0 },
  { capability: "behavior",   passCount: 1, total: 1, scorePct: 100, p50Ms: 76, p95Ms:  76, trend: [80, 90, 95, 95, 100, 100, 100, 100, 100, 100], deltaFromLastGreen:  0 },
  { capability: "refactor",   passCount: 1, total: 1, scorePct: 100, p50Ms: 68, p95Ms:  68, trend: [80, 85, 90, 95, 100, 100, 100, 100, 100, 100], deltaFromLastGreen:  0 },
  { capability: "blast",      passCount: 1, total: 1, scorePct: 100, p50Ms: 39, p95Ms:  39, trend: [90, 90, 95, 100, 100, 100, 100, 100, 100, 100], deltaFromLastGreen:  0 },
  { capability: "test-intel", passCount: 1, total: 1, scorePct: 100, p50Ms: 58, p95Ms:  58, trend: [70, 80, 90, 95, 100, 100, 100, 100, 100, 100], deltaFromLastGreen:  0 },
];

const routingRun: BenchRun = {
  runId: "bench-2026-04-24-rout-r418",
  startedAt: "2026-04-24T08:14:14Z",
  durationMs: 412,
  tasks: routingTasks,
  results: routingResults,
  capabilityScores: routingCapabilityScores,
  regressedTaskIds: [],
  flakyTaskIds: ["r-fl2"],
  overallScorePct: 100,
  lastGreenAt: "2026-04-23T08:09:31Z",
};

/* ═══════════════════════════════════════════════════════════════
   security.py — 9 tasks · 6 pass · 2 fail (taint regressions) · 1 skipped
   score 67% — golden expectation under review for skipped task
   ═══════════════════════════════════════════════════════════════ */

const securityTasks: GoldenTask[] = [
  { id: "s-t1",  capability: "taint",       description: "subject id reaches authz decision (NEW REGRESSION)",   fileName: "security.py", expectedSummary: "src=req.user_id → sink=audit.write expected; engine missed the path" },
  { id: "s-t2",  capability: "taint",       description: "scope leaks via legacy_bypass_flag (NEW REGRESSION)",  fileName: "security.py", expectedSummary: "expected: bypass-tainted scope flagged at L64" },
  { id: "s-t3",  capability: "taint",       description: "scope.contains is sanitizer barrier",                  fileName: "security.py", expectedSummary: "no propagation past scope.contains() guard" },
  { id: "s-b1",  capability: "blast",       description: "blast radius for authorize()",                         fileName: "security.py", expectedSummary: "['orchestrator.py', 'audit.py']" },
  { id: "s-az1", capability: "intent-gap",  description: "intent gap on legacy bypass branch",                   fileName: "security.py", expectedSummary: "comment 'TODO remove bypass' vs runtime path" },
  { id: "s-bh1", capability: "behavior",    description: "behavior diff: bypass flag off",                       fileName: "security.py", expectedSummary: "deny path engages, mutate_order skipped" },
  { id: "s-rf1", capability: "refactor",    description: "inline check_permission is safe",                      fileName: "security.py", expectedSummary: "no semantic change" },
  { id: "s-ir1", capability: "incident-replay", description: "replay finds authz leak at L88",                   fileName: "security.py", expectedSummary: "18 events, leak write at t=1120ms" },
  { id: "s-fl1", capability: "flow",        description: "audit-record write timing (UNDER REVIEW)",             fileName: "security.py", expectedSummary: "audit append before mutate; expectation contested" },
];

const securityResults: TaskResult[] = [
  { taskId: "s-t1",  outcome: "fail",    latencyMs: 156, detail: "expected: src=req.user_id → sink=audit.write\nactual:   no path emitted (regression vs r417)", stability30d: 0.32 },
  { taskId: "s-t2",  outcome: "fail",    latencyMs: 178, detail: "expected: bypass-tainted scope flagged at L64\nactual:   path missed (engine pruned bypass branch)", stability30d: 0.28 },
  { taskId: "s-t3",  outcome: "pass",    latencyMs:  74, detail: "sanitizer barrier respected",                                                                stability30d: 1.0  },
  { taskId: "s-b1",  outcome: "pass",    latencyMs:  62, detail: "blast = ['orchestrator.py', 'audit.py']",                                                    stability30d: 1.0  },
  { taskId: "s-az1", outcome: "pass",    latencyMs: 102, detail: "intent gap detected at bypass branch",                                                       stability30d: 1.0  },
  { taskId: "s-bh1", outcome: "pass",    latencyMs:  88, detail: "deny path engages with bypass off",                                                          stability30d: 1.0  },
  { taskId: "s-rf1", outcome: "pass",    latencyMs: 116, detail: "inline preserves invariants",                                                                stability30d: 1.0  },
  { taskId: "s-ir1", outcome: "pass",    latencyMs: 184, detail: "18 events, leak write at t=1120ms",                                                          stability30d: 1.0  },
  { taskId: "s-fl1", outcome: "skipped", latencyMs:   0, detail: "golden expectation under review (audit ordering contested in RFC-217)",                      stability30d: 1.0  },
];

const securityCapabilityScores: CapabilityScore[] = [
  { capability: "taint",            passCount: 1, total: 3, scorePct:  33, p50Ms: 156, p95Ms: 178, trend: [85, 85, 90, 90, 90, 95, 95, 90, 60, 33], deltaFromLastGreen: -2 },
  { capability: "blast",            passCount: 1, total: 1, scorePct: 100, p50Ms:  62, p95Ms:  62, trend: [80, 90, 95, 100, 100, 100, 100, 100, 100, 100], deltaFromLastGreen:  0 },
  { capability: "intent-gap",       passCount: 1, total: 1, scorePct: 100, p50Ms: 102, p95Ms: 102, trend: [60, 70, 80, 90, 95, 100, 100, 100, 100, 100], deltaFromLastGreen:  0 },
  { capability: "behavior",         passCount: 1, total: 1, scorePct: 100, p50Ms:  88, p95Ms:  88, trend: [70, 80, 90, 95, 100, 100, 100, 100, 100, 100], deltaFromLastGreen:  0 },
  { capability: "refactor",         passCount: 1, total: 1, scorePct: 100, p50Ms: 116, p95Ms: 116, trend: [80, 85, 90, 95, 100, 100, 100, 100, 100, 100], deltaFromLastGreen:  0 },
  { capability: "incident-replay",  passCount: 1, total: 1, scorePct: 100, p50Ms: 184, p95Ms: 184, trend: [70, 75, 85, 90, 95, 95, 100, 100, 100, 100], deltaFromLastGreen:  0 },
  { capability: "flow",             passCount: 0, total: 0, scorePct:   0, p50Ms:   0, p95Ms:   0, trend: [100, 100, 100, 100, 100, 100, 100, 100, 100, 0], deltaFromLastGreen:  0 },
];

const securityRun: BenchRun = {
  runId: "bench-2026-04-24-sec-r418",
  startedAt: "2026-04-24T08:14:21Z",
  durationMs: 960,
  tasks: securityTasks,
  results: securityResults,
  capabilityScores: securityCapabilityScores,
  regressedTaskIds: ["s-t1", "s-t2"],
  flakyTaskIds: [],
  overallScorePct: 67,
  lastGreenAt: "2026-04-15T08:01:09Z",
};

/* ─── Registry + lookup ──────────────────────────────────────── */

export const BENCH_RUNS: Record<string, BenchRun> = {
  "orchestrator.py":   orchestratorRun,
  "routing_policy.py": routingRun,
  "security.py":       securityRun,
};

export function getBenchRun(fileName: string): BenchRun | null {
  return BENCH_RUNS[fileName] ?? null;
}
