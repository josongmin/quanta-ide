import type {
  AgentRun,
  TokenRadarReport,
  AgentNode,
  FlameSlice,
  TaskCost,
  RetryLoop,
  PingpongCycle,
  ContextLeak,
  ReplayEvent,
  Recommendation,
  WasteSlice,
  FileHotspot,
  ToolStat,
} from "../model/types";

/* ════════════════════════════════════════════════════════════════════════
   MOCK 1 — orchestrator.py
   Run is BURNING. 42M tokens, $126.9, retry 7, status: failed.
   Pingpong between coder and reviewer over try/catch in dispatch().
   Cache miss heavy (only 12% hit). Reviewer overspending vs coder.
   Comparable tasks median $34 → 4σ outlier.
   ════════════════════════════════════════════════════════════════════════ */

const orchTree: AgentNode = {
  id: "orch:root",
  role: "orchestrator",
  label: "orchestrator (root)",
  totalTokens: 42_300_000,
  costUsd: 126.9,
  callCount: 247,
  shareOfParent: 1,
  children: [
    {
      id: "orch:planner",
      role: "planner",
      label: "planner",
      totalTokens: 1_270_000,
      costUsd: 4.2,
      callCount: 14,
      shareOfParent: 0.033,
      children: [],
      anomalyHint: "called 14× for the same task — replanning loop",
    },
    {
      id: "orch:coder",
      role: "coder",
      label: "coder",
      totalTokens: 11_840_000,
      costUsd: 38.1,
      callCount: 62,
      shareOfParent: 0.300,
      children: [
        {
          id: "orch:codegen-helper",
          role: "coder",
          label: "codegen-helper (subagent)",
          totalTokens: 5_900_000,
          costUsd: 19.0,
          callCount: 28,
          shareOfParent: 0.499,
          children: [],
          anomalyHint: "child > 50% of parent — collapse into parent prompt",
        },
      ],
    },
    {
      id: "orch:reviewer",
      role: "reviewer",
      label: "reviewer",
      totalTokens: 17_120_000,
      costUsd: 51.4,
      callCount: 89,
      shareOfParent: 0.405,
      anomalyHint: "reviewer > coder cost — read-full-file pattern",
      children: [
        { id: "orch:rev-doc",  role: "doc",      label: "doc-reviewer",  totalTokens: 4_650_000,  costUsd: 14.0, callCount: 22, shareOfParent: 0.272, children: [] },
        { id: "orch:rev-arch", role: "reviewer", label: "arch-reviewer", totalTokens: 9_350_000,  costUsd: 28.1, callCount: 38, shareOfParent: 0.547, children: [] },
        { id: "orch:rev-sec",  role: "security", label: "security-rev",  totalTokens: 3_120_000,  costUsd:  9.3, callCount: 29, shareOfParent: 0.181, children: [] },
      ],
    },
    {
      id: "orch:tester",
      role: "tester",
      label: "tester",
      totalTokens: 11_070_000,
      costUsd: 33.2,
      callCount: 82,
      shareOfParent: 0.262,
      anomalyHint: "tester loop > implementation — log bloat",
      children: [],
    },
  ],
};

const orchTasks: TaskCost[] = [
  { taskId: "TASK-17", title: "harden dispatch() for null user",       status: "failed",  totalTokens: 42_300_000, inputTokens: 38_900_000, outputTokens: 3_400_000, cachedTokens: 5_080_000, costUsd: 126.9, toolCalls: 247, retries: 7, durationMs: 1_812_000, touchesFocusedFile: true,  efficiencyGrade: "F", stuckness: 0.87 },
  { taskId: "TASK-18", title: "extract resolve_user helper",           status: "merged",  totalTokens:  8_140_000, inputTokens:  6_900_000, outputTokens: 1_240_000, cachedTokens: 4_320_000, costUsd:  24.3, toolCalls:  61, retries: 1, durationMs:   612_000, touchesFocusedFile: true,  efficiencyGrade: "B", stuckness: 0.04 },
  { taskId: "TASK-19", title: "rewrite plan_compose with caching",     status: "stuck",   totalTokens: 91_700_000, inputTokens: 84_100_000, outputTokens: 7_600_000, cachedTokens: 9_170_000, costUsd: 275.1, toolCalls: 412, retries: 12, durationMs: 4_810_000, touchesFocusedFile: true,  efficiencyGrade: "F", stuckness: 0.94 },
  { taskId: "TASK-20", title: "log dispatch policy decisions",         status: "merged",  totalTokens:  4_120_000, inputTokens:  3_400_000, outputTokens:   720_000, cachedTokens: 2_780_000, costUsd:  12.4, toolCalls:  31, retries: 0, durationMs:   281_000, touchesFocusedFile: true,  efficiencyGrade: "A", stuckness: 0.02 },
  { taskId: "TASK-21", title: "migrate plan model to v2",              status: "merged",  totalTokens:  9_140_000, inputTokens:  7_100_000, outputTokens: 2_040_000, cachedTokens: 6_400_000, costUsd:  27.4, toolCalls:  74, retries: 0, durationMs:   514_000, touchesFocusedFile: false, efficiencyGrade: "A", stuckness: 0.03 },
];

const orchFlame: FlameSlice[] = [
  { role: "planner",      share: 0.03, costUsd:  4.2,  tokens:  1_270_000, subSlices: [{ label: "initial plan", share: 0.6, tokens:    762_000 }, { label: "replan after fail", share: 0.4, tokens: 508_000 }] },
  { role: "coder",        share: 0.30, costUsd: 38.1,  tokens: 11_840_000, subSlices: [{ label: "diff write",         share: 0.55, tokens: 6_512_000 }, { label: "context recall", share: 0.30, tokens: 3_552_000 }, { label: "subagent helper", share: 0.15, tokens: 1_776_000 }] },
  { role: "reviewer",     share: 0.41, costUsd: 51.4,  tokens: 17_120_000, subSlices: [{ label: "read full file",  share: 0.45, tokens: 7_704_000 }, { label: "diff review", share: 0.24, tokens: 4_109_000 }, { label: "arch comments", share: 0.20, tokens: 3_424_000 }, { label: "repeated context", share: 0.11, tokens: 1_883_000 }] },
  { role: "tester",       share: 0.19, costUsd: 33.2,  tokens: 11_070_000, subSlices: [{ label: "log injection",    share: 0.52, tokens: 5_756_000 }, { label: "rerun retry", share: 0.31, tokens: 3_432_000 }, { label: "compress summary", share: 0.17, tokens: 1_882_000 }] },
  { role: "summarizer",   share: 0.07, costUsd:  9.0,  tokens:  3_000_000, subSlices: [{ label: "task summary",      share: 1.0, tokens: 3_000_000 }] },
];

const orchRetryLoops: RetryLoop[] = [
  {
    taskId: "TASK-17",
    pattern: [
      "run pnpm test orchestrator",
      "fail: 'Cannot read property userId of undefined'",
      "patch auth/middleware.ts",
      "rerun",
      "same failure",
    ],
    repeats: 6,
    wastedUsd: 41.2,
    intervention: "stop autonomous retry — human decision required",
  },
  {
    taskId: "TASK-19",
    pattern: [
      "compose_plan stub",
      "type-check fails: 'PlanArgs missing field meta'",
      "regenerate stub",
      "same failure",
    ],
    repeats: 4,
    wastedUsd: 18.6,
    intervention: "request schema from .ai/AGENT.md instead of guessing",
  },
];

const orchPingpong: PingpongCycle[] = [
  {
    id: "pp-1",
    subjectFile: "src/auth/middleware.ts",
    subjectLineSpan: "L42-L58",
    cycles: 3,
    narrative: [
      { actor: "coder",    action: "added",   at: "10:04" },
      { actor: "reviewer", action: "removed", at: "10:18" },
      { actor: "coder",    action: "added",   at: "10:31" },
      { actor: "reviewer", action: "removed", at: "10:44" },
      { actor: "coder",    action: "rewritten", at: "10:57" },
      { actor: "reviewer", action: "removed", at: "11:09" },
    ],
    resolution: "human-required",
  },
];

const orchContextLeaks: ContextLeak[] = [
  { id: "lk-rfc",   source: "RFC-217.md",                injections: 37, sizeKb: 84,  wastedUsd: 22.4, repetitionRatio: 0.72, recommendation: "replace with task-scoped summary block (≤ 2 KB)" },
  { id: "lk-auth",  source: "src/auth/service.ts",       injections: 22, sizeKb: 19,  wastedUsd:  8.1, repetitionRatio: 0.41, recommendation: "cache file summary + only refetch on edit" },
  { id: "lk-test",  source: "test-output/dispatch.log",  injections: 11, sizeKb: 412, wastedUsd: 17.8, repetitionRatio: 0.88, recommendation: "compress log → top-failures struct before re-injection" },
  { id: "lk-prompt",source: "system prompt v3",          injections:189, sizeKb:  6,  wastedUsd:  9.4, repetitionRatio: 0.92, recommendation: "add cache_control breakpoint at end of system block" },
];

const orchHotspots: FileHotspot[] = [
  { fileName: "src/auth/service.ts",       tokens: 18_240_000, reads: 22, modifies: 4, reverts: 1, share: 0.43, isFocused: false },
  { fileName: "orchestrator.py",           tokens: 11_700_000, reads: 18, modifies: 9, reverts: 3, share: 0.28, isFocused: true  },
  { fileName: "src/app/router.ts",         tokens:  4_180_000, reads:  8, modifies: 2, reverts: 0, share: 0.10, isFocused: false },
  { fileName: "prisma/schema.prisma",      tokens:  3_290_000, reads:  6, modifies: 1, reverts: 0, share: 0.08, isFocused: false },
  { fileName: "test/auth.test.ts",         tokens:  2_410_000, reads: 11, modifies: 0, reverts: 0, share: 0.06, isFocused: false },
  { fileName: "src/auth/middleware.ts",    tokens:  1_240_000, reads:  9, modifies: 7, reverts: 6, share: 0.03, isFocused: false },
];

const orchTools: ToolStat[] = [
  { tool: "read",  calls: 142, costUsd: 42.0, deadRatio: 0.18, outputKbP50: 12, outputKbP95: 84 },
  { tool: "grep",  calls:  62, costUsd: 12.0, deadRatio: 0.44, outputKbP50:  3, outputKbP95: 21 },
  { tool: "bash",  calls:  31, costUsd:  8.4, deadRatio: 0.06, outputKbP50: 18, outputKbP95: 412 },
  { tool: "edit",  calls:  18, costUsd:  2.1, deadRatio: 0.00, outputKbP50:  1, outputKbP95:  4 },
  { tool: "task",  calls:   8, costUsd:  9.0, deadRatio: 0.12, outputKbP50:  6, outputKbP95: 22 },
];

const orchReplay: ReplayEvent[] = [
  { at: "00:00", kind: "plan",    actor: "planner",      label: "initial plan generated",                                                            costUsd: 0.4 },
  { at: "00:14", kind: "tool",    actor: "coder",        label: "Read src/auth/service.ts (full file, 19 KB)",                                       costUsd: 0.6, touchesFocusedFile: false },
  { at: "00:21", kind: "edit",    actor: "coder",        label: "Edit orchestrator.py:dispatch — add try/catch on req.user",                          costUsd: 0.9, touchesFocusedFile: true },
  { at: "00:32", kind: "test",    actor: "tester",       label: "pnpm test orchestrator → FAIL (Cannot read property userId of undefined)",          costUsd: 0.5, detail: "log: 412 KB injected back to context" },
  { at: "00:41", kind: "edit",    actor: "coder",        label: "Edit src/auth/middleware.ts — patch req.user fallback",                              costUsd: 0.8 },
  { at: "00:48", kind: "test",    actor: "tester",       label: "rerun tests → same failure",                                                        costUsd: 0.5 },
  { at: "01:04", kind: "review",  actor: "reviewer",     label: "reject middleware patch (architectural smell)",                                     costUsd: 1.6 },
  { at: "01:18", kind: "edit",    actor: "coder",        label: "Re-add middleware patch (cycle #2)",                                                costUsd: 0.8 },
  { at: "01:31", kind: "review",  actor: "reviewer",     label: "reject again (PINGPONG)",                                                            costUsd: 1.7 },
  { at: "01:42", kind: "compact", actor: "system",       label: "auto-compaction — 19 KB context dropped (test log + 3 file reads)",                 costUsd: 0.0, detail: "regen on next turn cost ~$5.7" },
  { at: "02:00", kind: "alert",   actor: "system",       label: "🚨 SECRET LEAK detected (AWS access key from src/.env)",                            costUsd: 0.0 },
  { at: "02:14", kind: "edit",    actor: "coder",        label: "Re-rewrite middleware (cycle #3)",                                                  costUsd: 0.9 },
  { at: "02:30", kind: "rollback",actor: "human",        label: "human paused run — budget guard tripped at $126.9",                                  costUsd: 0.0 },
];

const orchWaste: WasteSlice[] = [
  { category: "repeated_context",    percent: 31, usd: 39.3, fix: "add cache_control breakpoint after system + RFC blocks" },
  { category: "failed_retries",      percent: 26, usd: 33.0, fix: "stop retrying after 3 identical failures" },
  { category: "overbroad_review",    percent: 17, usd: 21.6, fix: "feed reviewer the diff, not the full file" },
  { category: "full_file_reads",     percent: 12, usd: 15.2, fix: "use cached file summaries; only re-read on edit" },
  { category: "test_log_bloat",      percent:  8, usd: 10.2, fix: "summarize logs into top-failures struct before re-injection" },
  { category: "unclear_task_scope",  percent:  6, usd:  7.6, fix: "tighten task tag — `auth refactor` was treated as broad" },
];

const orchRecommendations: Recommendation[] = [
  { id: "rec-1", origin: "secret",   severity: "critical", title: "AWS key leaked at 02:00 — rotate now",                       impact: "compliance / blast",                  body: "src/.env was injected into reviewer prompt. Treat the key as compromised even if you cancel the run." },
  { id: "rec-2", origin: "policy",   severity: "critical", title: "Budget guard tripped at $126.9 / max $80",                  impact: "stop further burn",                   body: "Run is paused. Resume requires explicit approval; recommended: re-scope task instead of resume." },
  { id: "rec-3", origin: "cache",    severity: "warn",     title: "Cache hit only 12% — $182/day on the table",                impact: "−$182/day if breakpoints added",      body: "System prompt + RFC-217 are stable across 189 calls. Add cache_control breakpoints at both." },
  { id: "rec-4", origin: "model",    severity: "warn",     title: "26 review calls could move to Sonnet (−$31)",                impact: "−$31 with no quality regression",     body: "Doc-reviewer outputs are short and cite-heavy — Sonnet matches Opus on this distribution." },
  { id: "rec-5", origin: "pingpong", severity: "warn",     title: "Pingpong on auth/middleware.ts L42-L58 (3 cycles)",         impact: "human required",                       body: "Coder & reviewer disagree on architectural placement of try/catch. Auto-retry cannot resolve." },
  { id: "rec-6", origin: "context",  severity: "advice",   title: "RFC-217.md re-injected 37× — replace with summary",        impact: "−$22 / future runs",                   body: "Build a 2-KB task-scoped extract once and inject the extract instead of the full RFC." },
  { id: "rec-7", origin: "stuck",    severity: "warn",     title: "Stuck probability 87% — recommend pause + summarize",       impact: "stop oscillation",                     body: "Same failure pattern repeated 6×. Generate state summary and ask for human direction." },
];

const orchRun: AgentRun = {
  runId: "run-2026-04-28-orch-r418",
  startedAt: "2026-04-28T08:14:02Z",
  status: "paused",
  elapsedMs: 1_812_000,
  totalTokens: 42_300_000,
  inputTokens: 38_900_000,
  outputTokens: 3_400_000,
  costUsd: 126.9,
  toolCalls: 247,
  retries: 7,
  taskCount: 5,

  cache: {
    hitRatio: 0.12,
    cachedTokens: 5_080_000,
    uncachedTokens: 37_220_000,
    estimatedDailySavingsUsd: 182,
    suggestions: [
      { label: "system prompt (v3)",         uses: 247, hitRatio: 0.00, savingsUsd: 88, stability: "stable" },
      { label: "RFC-217.md task block",       uses:  37, hitRatio: 0.05, savingsUsd: 64, stability: "stable" },
      { label: "src/auth/service.ts read",   uses:  22, hitRatio: 0.18, savingsUsd: 30, stability: "stable" },
      { label: "task-specific instructions", uses: 247, hitRatio: 0.40, savingsUsd:  0, stability: "drift" },
    ],
  },

  modelAudit: {
    totalCalls: 247,
    actual: [
      { model: "claude-opus-4-7",   calls: 142, costUsd: 89.6 },
      { model: "claude-sonnet-4-6", calls:  78, costUsd: 28.1 },
      { model: "claude-haiku-4-5",  calls:  27, costUsd:  9.2 },
    ],
    rightSized: [
      { model: "claude-opus-4-7",   calls:  53, costUsd: 31.7 },
      { model: "claude-sonnet-4-6", calls: 122, costUsd: 41.3 },
      { model: "claude-haiku-4-5",  calls:  72, costUsd: 23.0 },
    ],
    overspendUsd: 30.9,
    score: "D",
    advice: [
      "26 doc-review calls match Sonnet output distribution → −$31",
      "22 file-classification calls fit Haiku → −$31",
      "11 review calls correctly used Opus (deep code reasoning)",
    ],
  },

  secretEgress: [
    {
      id: "sec-1",
      severity: "critical",
      pattern: "AWS access key",
      preview: "AKIA…rotated…UTHQ",
      source: "src/.env",
      occurredAt: "2026-04-28T08:46:00Z",
      agentRole: "reviewer",
      remediation: "Rotate the key immediately. Delete cached prompt; the value persists in cache for 5min TTL.",
    },
  ],

  agentTree: orchTree,

  forecast: {
    burnUsdPerMin: 4.2,
    elapsedMs: 1_812_000,
    projectedTotalUsd: 412.0,
    projectedFinishAt: "2026-04-28T09:48:00Z",
    medianSimilarUsd: 34.0,
    p95SimilarUsd: 89.0,
    zScore: 4.2,
    comparableTag: "auth refactor",
    similarN: 14,
  },

  flame: orchFlame,

  retryLoops: orchRetryLoops,

  stuckness: {
    probability: 0.87,
    reasons: [
      "same failure repeated 6×",
      "no net diff progress (churn ratio 4.7×)",
      "reviewer rejected same section 3×",
      "no new files discovered in last 14 events",
    ],
    recommendedAction: "summarize-and-pause",
  },

  pingpong: orchPingpong,

  convergence: {
    ticks:      ["00:00", "05:00", "10:00", "15:00", "20:00", "25:00", "30:00"],
    failures:   [0, 2, 4, 5, 6, 6, 7],
    churn:      [0, 64, 142, 218, 281, 360, 412],
    rejections: [0, 0, 1, 2, 2, 3, 3],
  },

  waste: orchWaste,

  contextLeaks: orchContextLeaks,

  diffEfficiency: {
    totalTokens: 42_300_000,
    linesChanged: 86,
    tokensPerLoc: 491_860,
    grade: "F",
    label: "runaway",
    percentile: 4,
  },

  diffChurn: {
    linesAdded: 412,
    linesDeleted: 326,
    reAdded: 184,
    reverted: 196,
    churnRatio: 4.72,
    churnUsd: 31.4,
  },

  fileHotspots: orchHotspots,

  tools: orchTools,

  testLogBloat: {
    rawBytes: 18 * 1024 * 1024 + 410 * 1024,
    compressedBytes: 1 * 1024 * 1024 + 220 * 1024,
    savingsPct: 93.4,
    topRecurringFailures: [
      { message: "Cannot read property userId of undefined",  count: 8 },
      { message: "timeout in auth refresh test",              count: 5 },
      { message: "type mismatch UserSession",                 count: 3 },
    ],
  },

  planAdherence: {
    plannedSteps: 5,
    actualSteps: 23,
    plannedFiles: 3,
    actualFiles: 14,
    adherence: 0.31,
    unplannedFiles: [
      "src/auth/middleware.ts",
      "src/auth/legacy-bypass.ts",
      "prisma/schema.prisma",
      "src/app/router.ts",
      "test/integration/dispatch.test.ts",
      "src/policy/registry.ts",
      "src/audit/writer.ts",
      "src/auth/sessions.ts",
      "src/payment/service.ts",
      "src/app/error-boundary.tsx",
      "src/app/feature-flags.ts",
    ],
    label: "scope-creep",
  },

  knowledgeSpread: {
    startedDomains: ["auth/"],
    currentDomains: [
      { domain: "auth/",         touchPct: 0.42, growthPerHour: 1.1 },
      { domain: "payment/",      touchPct: 0.18, growthPerHour: 0.6 },
      { domain: "db/",           touchPct: 0.16, growthPerHour: 0.5 },
      { domain: "frontend/",     touchPct: 0.12, growthPerHour: 0.4 },
      { domain: "observability/",touchPct: 0.08, growthPerHour: 0.3 },
      { domain: "infra/",        touchPct: 0.04, growthPerHour: 0.1 },
    ],
    spreadIndex: 0.78,
  },

  compaction: {
    events: [
      { at: "01:42", droppedKb: 19, topics: ["test failure log", "src/auth/service.ts read"] },
      { at: "02:01", droppedKb: 11, topics: ["RFC-217 partial (re-fetched)"] },
    ],
    regenTokens: 19_000,
    regenCostUsd: 5.7,
  },

  streaming: {
    cancelledTokens: 184_000,
    cancelledCalls: 9,
    wallClockWastedMs: 38_000,
    reason: "user typed input mid-generation; calls cancelled",
  },

  reproducibility: {
    sampledCalls: 32,
    divergentCalls: 4,
    divergencePct: 12.5,
    suspectedCause: "router fell back to Sonnet at 01:18 (Opus capacity limit)",
  },

  replay: orchReplay,

  budget: {
    maxCostUsd: 80,
    maxRetries: 3,
    maxFilesRead: 30,
    maxWallMinutes: 90,
    onBreach: "summarize-and-require-approval",
  },

  violations: [
    { id: "v-1", guard: "maxCostUsd",  observed: "$126.9",  threshold: "$80",   status: "auto-paused" },
    { id: "v-2", guard: "maxRetries",  observed: "7",       threshold: "3",     status: "tripped"     },
    { id: "v-3", guard: "maxFilesRead",observed: "47",      threshold: "30",    status: "tripped"     },
  ],

  recommendations: orchRecommendations,

  tasks: orchTasks,
};

const orchReport: TokenRadarReport = {
  fileName: "orchestrator.py",
  run: orchRun,
  fileTouchingTaskIds: ["TASK-17", "TASK-18", "TASK-19", "TASK-20"],
  fileStats: {
    fileName: "orchestrator.py",
    tokens: 11_700_000,
    reads: 18,
    modifies: 9,
    reverts: 3,
    share: 0.28,
    isFocused: true,
  },
};

/* ════════════════════════════════════════════════════════════════════════
   MOCK 2 — routing_policy.py
   Healthy run. 8M tokens, $24, 1 retry, status: merged.
   Cache 71%, A grade efficiency, on-plan, low waste.
   ════════════════════════════════════════════════════════════════════════ */

const routTree: AgentNode = {
  id: "rout:root",
  role: "orchestrator",
  label: "orchestrator (root)",
  totalTokens: 8_140_000,
  costUsd: 24.3,
  callCount: 61,
  shareOfParent: 1,
  children: [
    { id: "rout:planner",  role: "planner",  label: "planner",  totalTokens:    490_000, costUsd:  1.4, callCount:  4, shareOfParent: 0.058, children: [] },
    { id: "rout:coder",    role: "coder",    label: "coder",    totalTokens:  4_120_000, costUsd: 12.4, callCount: 22, shareOfParent: 0.510, children: [] },
    { id: "rout:reviewer", role: "reviewer", label: "reviewer", totalTokens:  2_260_000, costUsd:  6.7, callCount: 18, shareOfParent: 0.276, children: [] },
    { id: "rout:tester",   role: "tester",   label: "tester",   totalTokens:  1_270_000, costUsd:  3.8, callCount: 17, shareOfParent: 0.156, children: [] },
  ],
};

const routTasks: TaskCost[] = [
  { taskId: "TASK-22", title: "rename score_rule → rank_rule",          status: "merged",  totalTokens: 8_140_000, inputTokens: 6_900_000, outputTokens: 1_240_000, cachedTokens: 5_780_000, costUsd: 24.3, toolCalls: 61, retries: 1, durationMs: 612_000, touchesFocusedFile: true,  efficiencyGrade: "A", stuckness: 0.04 },
  { taskId: "TASK-23", title: "add geoip resolver fallback",            status: "merged",  totalTokens: 3_410_000, inputTokens: 2_780_000, outputTokens:   630_000, cachedTokens: 2_420_000, costUsd: 10.2, toolCalls: 41, retries: 0, durationMs: 318_000, touchesFocusedFile: true,  efficiencyGrade: "A", stuckness: 0.03 },
];

const routFlame: FlameSlice[] = [
  { role: "planner",    share: 0.06, costUsd:  1.4, tokens:   490_000, subSlices: [{ label: "initial plan", share: 1.0, tokens: 490_000 }] },
  { role: "coder",      share: 0.51, costUsd: 12.4, tokens: 4_120_000, subSlices: [{ label: "diff write", share: 0.7, tokens: 2_884_000 }, { label: "context recall", share: 0.3, tokens: 1_236_000 }] },
  { role: "reviewer",   share: 0.28, costUsd:  6.7, tokens: 2_260_000, subSlices: [{ label: "diff review", share: 0.85, tokens: 1_921_000 }, { label: "minor nits", share: 0.15, tokens: 339_000 }] },
  { role: "tester",     share: 0.16, costUsd:  3.8, tokens: 1_270_000, subSlices: [{ label: "test run", share: 1.0, tokens: 1_270_000 }] },
];

const routRecommendations: Recommendation[] = [
  { id: "r-rec-1", origin: "cache", severity: "info",   title: "Cache hit 71% — within healthy band",                          impact: "no action",                       body: "System + RFC blocks reused, breakpoints already optimal." },
  { id: "r-rec-2", origin: "model", severity: "advice", title: "Planner could move to Haiku on next similar task",              impact: "−$1 estimated",                  body: "Plan shape is stable; Haiku has matched Sonnet on 12/12 prior runs." },
];

const routRun: AgentRun = {
  runId: "run-2026-04-28-rout-r418",
  startedAt: "2026-04-28T09:14:14Z",
  status: "merged",
  elapsedMs: 612_000,
  totalTokens: 8_140_000,
  inputTokens: 6_900_000,
  outputTokens: 1_240_000,
  costUsd: 24.3,
  toolCalls: 61,
  retries: 1,
  taskCount: 2,

  cache: {
    hitRatio: 0.71,
    cachedTokens: 5_780_000,
    uncachedTokens: 2_360_000,
    estimatedDailySavingsUsd: 0,
    suggestions: [
      { label: "system prompt (v3)",  uses: 61, hitRatio: 0.95, savingsUsd: 0, stability: "stable" },
      { label: "RFC-217.md task block", uses: 12, hitRatio: 0.92, savingsUsd: 0, stability: "stable" },
    ],
  },

  modelAudit: {
    totalCalls: 61,
    actual: [
      { model: "claude-opus-4-7",   calls:  4, costUsd:  2.4 },
      { model: "claude-sonnet-4-6", calls: 38, costUsd: 14.6 },
      { model: "claude-haiku-4-5",  calls: 19, costUsd:  7.3 },
    ],
    rightSized: [
      { model: "claude-opus-4-7",   calls:  4, costUsd:  2.4 },
      { model: "claude-sonnet-4-6", calls: 35, costUsd: 13.4 },
      { model: "claude-haiku-4-5",  calls: 22, costUsd:  8.5 },
    ],
    overspendUsd: 0.0,
    score: "A",
    advice: ["right-sizing already near-optimal — keep current router policy"],
  },

  secretEgress: [],

  agentTree: routTree,

  forecast: {
    burnUsdPerMin: 0,
    elapsedMs: 612_000,
    projectedTotalUsd: 24.3,
    projectedFinishAt: "2026-04-28T09:24:26Z",
    medianSimilarUsd: 22.0,
    p95SimilarUsd: 38.0,
    zScore: 0.4,
    comparableTag: "rename refactor",
    similarN: 31,
  },

  flame: routFlame,

  retryLoops: [],

  stuckness: { probability: 0.04, reasons: ["forward progress on every step"], recommendedAction: "continue" },

  pingpong: [],

  convergence: {
    ticks:      ["00:00", "01:00", "02:00", "03:00", "05:00", "07:00", "10:00"],
    failures:   [1, 0, 0, 0, 0, 0, 0],
    churn:      [0, 14, 28, 38, 49, 56, 58],
    rejections: [0, 0, 0, 0, 0, 0, 0],
  },

  waste: [
    { category: "repeated_context", percent:  4, usd: 0.6, fix: "no action — within healthy band" },
    { category: "full_file_reads",  percent:  3, usd: 0.4, fix: "no action" },
    { category: "test_log_bloat",   percent:  2, usd: 0.3, fix: "no action" },
  ],

  contextLeaks: [],

  diffEfficiency: { totalTokens: 8_140_000, linesChanged: 740, tokensPerLoc: 11_000, grade: "A", label: "productive", percentile: 92 },

  diffChurn: { linesAdded: 612, linesDeleted: 128, reAdded: 6, reverted: 8, churnRatio: 1.0, churnUsd: 0.4 },

  fileHotspots: [
    { fileName: "routing_policy.py",     tokens: 4_120_000, reads:  6, modifies: 4, reverts: 0, share: 0.51, isFocused: true  },
    { fileName: "test/routing.test.ts",  tokens: 1_510_000, reads:  4, modifies: 1, reverts: 0, share: 0.19, isFocused: false },
    { fileName: "src/policy/registry.ts",tokens:   620_000, reads:  3, modifies: 0, reverts: 0, share: 0.08, isFocused: false },
  ],

  tools: [
    { tool: "read", calls: 24, costUsd:  6.0, deadRatio: 0.04, outputKbP50:  4, outputKbP95: 18 },
    { tool: "grep", calls: 12, costUsd:  1.4, deadRatio: 0.16, outputKbP50:  1, outputKbP95:  6 },
    { tool: "edit", calls: 18, costUsd:  2.1, deadRatio: 0.00, outputKbP50:  1, outputKbP95:  3 },
    { tool: "bash", calls:  7, costUsd:  0.9, deadRatio: 0.00, outputKbP50:  3, outputKbP95: 11 },
  ],

  testLogBloat: {
    rawBytes: 64 * 1024,
    compressedBytes: 8 * 1024,
    savingsPct: 87.5,
    topRecurringFailures: [],
  },

  planAdherence: {
    plannedSteps: 4,
    actualSteps: 5,
    plannedFiles: 2,
    actualFiles: 3,
    adherence: 0.95,
    unplannedFiles: ["test/routing.test.ts"],
    label: "on-plan",
  },

  knowledgeSpread: {
    startedDomains: ["routing/"],
    currentDomains: [
      { domain: "routing/", touchPct: 0.83, growthPerHour: 0.4 },
      { domain: "policy/",  touchPct: 0.17, growthPerHour: 0.0 },
    ],
    spreadIndex: 0.12,
  },

  compaction: { events: [], regenTokens: 0, regenCostUsd: 0 },

  streaming: { cancelledTokens: 0, cancelledCalls: 0, wallClockWastedMs: 0, reason: "no cancellations" },

  reproducibility: { sampledCalls: 12, divergentCalls: 0, divergencePct: 0, suspectedCause: "deterministic" },

  replay: [
    { at: "00:00", kind: "plan",   actor: "planner",  label: "plan: rename score_rule → rank_rule (3 references)",        costUsd: 0.4 },
    { at: "00:08", kind: "edit",   actor: "coder",    label: "Edit routing_policy.py — rename symbol",                     costUsd: 1.6, touchesFocusedFile: true },
    { at: "00:14", kind: "tool",   actor: "coder",    label: "Grep references → 3 hits, all in routing/",                  costUsd: 0.2 },
    { at: "00:21", kind: "edit",   actor: "coder",    label: "Update 3 callers",                                            costUsd: 1.2, touchesFocusedFile: true },
    { at: "00:30", kind: "test",   actor: "tester",   label: "pnpm test routing → PASS",                                    costUsd: 0.4 },
    { at: "00:34", kind: "review", actor: "reviewer", label: "approve",                                                     costUsd: 0.3 },
    { at: "00:38", kind: "human",  actor: "human",    label: "merged",                                                      costUsd: 0.0 },
  ],

  budget: { maxCostUsd: 80, maxRetries: 3, maxFilesRead: 30, maxWallMinutes: 90, onBreach: "summarize-and-require-approval" },

  violations: [],

  recommendations: routRecommendations,

  tasks: routTasks,
};

const routReport: TokenRadarReport = {
  fileName: "routing_policy.py",
  run: routRun,
  fileTouchingTaskIds: ["TASK-22", "TASK-23"],
  fileStats: { fileName: "routing_policy.py", tokens: 4_120_000, reads: 6, modifies: 4, reverts: 0, share: 0.51, isFocused: true },
};

/* ════════════════════════════════════════════════════════════════════════
   MOCK 3 — security.py
   Live run. 13M tokens, $42, retry 3, status: running.
   Reproducibility drift detected, scope creeping out of auth/, mid-tier waste.
   ════════════════════════════════════════════════════════════════════════ */

const secTree: AgentNode = {
  id: "sec:root",
  role: "orchestrator",
  label: "orchestrator (root)",
  totalTokens: 13_840_000,
  costUsd: 42.1,
  callCount: 124,
  shareOfParent: 1,
  children: [
    { id: "sec:planner",  role: "planner",  label: "planner",  totalTokens:    920_000, costUsd:  2.7, callCount:  6, shareOfParent: 0.066, children: [] },
    { id: "sec:coder",    role: "coder",    label: "coder",    totalTokens:  5_870_000, costUsd: 17.8, callCount: 38, shareOfParent: 0.424, children: [] },
    { id: "sec:reviewer", role: "reviewer", label: "reviewer", totalTokens:  3_240_000, costUsd:  9.7, callCount: 28, shareOfParent: 0.234, children: [] },
    { id: "sec:security", role: "security", label: "security-rev", totalTokens: 2_180_000, costUsd: 6.5, callCount: 22, shareOfParent: 0.157, children: [], anomalyHint: "security-rev called 22× — pattern of repeat scans" },
    { id: "sec:tester",   role: "tester",   label: "tester",   totalTokens:  1_630_000, costUsd:  4.9, callCount: 30, shareOfParent: 0.118, children: [] },
  ],
};

const secTasks: TaskCost[] = [
  { taskId: "TASK-24", title: "tighten authorize() decision path",  status: "running", totalTokens: 13_840_000, inputTokens: 11_900_000, outputTokens: 1_940_000, cachedTokens: 4_840_000, costUsd: 42.1, toolCalls: 124, retries: 3, durationMs: 921_000, touchesFocusedFile: true, efficiencyGrade: "C", stuckness: 0.34 },
  { taskId: "TASK-25", title: "remove legacy bypass branch",        status: "merged",  totalTokens:  4_210_000, inputTokens:  3_500_000, outputTokens:   710_000, cachedTokens: 2_870_000, costUsd: 12.6, toolCalls:  38, retries: 0, durationMs: 287_000, touchesFocusedFile: true, efficiencyGrade: "B", stuckness: 0.05 },
];

const secFlame: FlameSlice[] = [
  { role: "planner",    share: 0.07, costUsd:  2.7, tokens:   920_000, subSlices: [{ label: "initial plan", share: 0.7, tokens: 644_000 }, { label: "replan after scope shift", share: 0.3, tokens: 276_000 }] },
  { role: "coder",      share: 0.42, costUsd: 17.8, tokens: 5_870_000, subSlices: [{ label: "diff write", share: 0.6, tokens: 3_522_000 }, { label: "context recall", share: 0.4, tokens: 2_348_000 }] },
  { role: "reviewer",   share: 0.23, costUsd:  9.7, tokens: 3_240_000, subSlices: [{ label: "diff review", share: 0.7, tokens: 2_268_000 }, { label: "arch comments", share: 0.3, tokens: 972_000 }] },
  { role: "security",   share: 0.16, costUsd:  6.5, tokens: 2_180_000, subSlices: [{ label: "static scan", share: 0.6, tokens: 1_308_000 }, { label: "secret scan", share: 0.4, tokens: 872_000 }] },
  { role: "tester",     share: 0.12, costUsd:  4.9, tokens: 1_630_000, subSlices: [{ label: "test run", share: 0.8, tokens: 1_304_000 }, { label: "log compress", share: 0.2, tokens: 326_000 }] },
];

const secRetryLoops: RetryLoop[] = [
  {
    taskId: "TASK-24",
    pattern: ["run authz tests", "fail: subject id missing in audit", "patch authorize()", "retry"],
    repeats: 3,
    wastedUsd: 7.4,
    intervention: "policy: stop after 3 identical failures (already armed)",
  },
];

const secRecommendations: Recommendation[] = [
  { id: "s-rec-1", origin: "scope",    severity: "warn",    title: "Scope spreading from auth/ → audit/, payment/",          impact: "drift index 0.54",                body: "Started in auth/. Now touching audit + payment. Consider re-scoping or splitting task." },
  { id: "s-rec-2", origin: "model",    severity: "advice",  title: "8 security-rev calls fit Sonnet",                         impact: "−$2.4",                            body: "Static scan output is structured; Sonnet handled prior 19/19 cleanly." },
  { id: "s-rec-3", origin: "tool",     severity: "advice",  title: "Grep dead-call rate 38% — refine queries",                impact: "−$1.4",                            body: "12/31 grep calls returned 0 useful matches; tighten patterns or use ast-grep." },
];

const secRun: AgentRun = {
  runId: "run-2026-04-28-sec-r418",
  startedAt: "2026-04-28T09:35:21Z",
  status: "running",
  elapsedMs: 921_000,
  totalTokens: 13_840_000,
  inputTokens: 11_900_000,
  outputTokens: 1_940_000,
  costUsd: 42.1,
  toolCalls: 124,
  retries: 3,
  taskCount: 2,

  cache: {
    hitRatio: 0.35,
    cachedTokens: 4_840_000,
    uncachedTokens: 9_000_000,
    estimatedDailySavingsUsd: 38,
    suggestions: [
      { label: "system prompt (v3)",        uses: 124, hitRatio: 0.61, savingsUsd: 18, stability: "stable" },
      { label: "auth/ overview block",      uses:  44, hitRatio: 0.20, savingsUsd: 14, stability: "stable" },
      { label: "task-specific instructions", uses: 124, hitRatio: 0.42, savingsUsd:  0, stability: "drift" },
    ],
  },

  modelAudit: {
    totalCalls: 124,
    actual: [
      { model: "claude-opus-4-7",   calls: 38, costUsd: 16.4 },
      { model: "claude-sonnet-4-6", calls: 64, costUsd: 19.2 },
      { model: "claude-haiku-4-5",  calls: 22, costUsd:  6.5 },
    ],
    rightSized: [
      { model: "claude-opus-4-7",   calls: 22, costUsd:  9.5 },
      { model: "claude-sonnet-4-6", calls: 72, costUsd: 21.6 },
      { model: "claude-haiku-4-5",  calls: 30, costUsd:  8.7 },
    ],
    overspendUsd: 6.9,
    score: "B",
    advice: [
      "16 review calls could move to Sonnet (−$5)",
      "8 file-classification calls fit Haiku (−$2)",
    ],
  },

  secretEgress: [],

  agentTree: secTree,

  forecast: {
    burnUsdPerMin: 2.8,
    elapsedMs: 921_000,
    projectedTotalUsd: 78.0,
    projectedFinishAt: "2026-04-28T10:08:00Z",
    medianSimilarUsd: 51.0,
    p95SimilarUsd: 92.0,
    zScore: 1.1,
    comparableTag: "authz tighten",
    similarN: 9,
  },

  flame: secFlame,

  retryLoops: secRetryLoops,

  stuckness: {
    probability: 0.34,
    reasons: ["one retry loop active", "convergence positive"],
    recommendedAction: "continue",
  },

  pingpong: [],

  convergence: {
    ticks:      ["00:00", "02:00", "05:00", "08:00", "11:00", "14:00", "15:00"],
    failures:   [0, 1, 1, 2, 1, 0, 0],
    churn:      [0, 28, 64, 92, 118, 142, 156],
    rejections: [0, 0, 1, 1, 1, 1, 1],
  },

  waste: [
    { category: "repeated_context",  percent: 18, usd: 7.6, fix: "add cache breakpoint after auth/ overview block" },
    { category: "failed_retries",    percent: 14, usd: 5.9, fix: "armed: max-retries=3 will trip on next failure" },
    { category: "overbroad_review",  percent:  9, usd: 3.8, fix: "feed reviewer the diff, not full file" },
    { category: "full_file_reads",   percent:  6, usd: 2.5, fix: "use cached file summaries" },
  ],

  contextLeaks: [
    { id: "lk-rfc-sec",   source: "RFC-219.md (authz)",        injections: 18, sizeKb:  44, wastedUsd:  6.2, repetitionRatio: 0.61, recommendation: "summarize section 3 only" },
    { id: "lk-overview",  source: "auth/ overview block",      injections: 44, sizeKb:  14, wastedUsd:  3.8, repetitionRatio: 0.40, recommendation: "add cache_control breakpoint" },
  ],

  diffEfficiency: { totalTokens: 13_840_000, linesChanged: 184, tokensPerLoc: 75_217, grade: "C", label: "suspicious", percentile: 41 },

  diffChurn: { linesAdded: 184, linesDeleted: 56, reAdded: 14, reverted: 18, churnRatio: 1.6, churnUsd: 4.1 },

  fileHotspots: [
    { fileName: "security.py",           tokens: 6_280_000, reads: 12, modifies: 6, reverts: 1, share: 0.45, isFocused: true  },
    { fileName: "src/audit/writer.ts",   tokens: 2_140_000, reads:  6, modifies: 2, reverts: 0, share: 0.15, isFocused: false },
    { fileName: "src/auth/policies.ts",  tokens: 1_840_000, reads:  4, modifies: 1, reverts: 0, share: 0.13, isFocused: false },
    { fileName: "test/authz.test.ts",    tokens: 1_240_000, reads:  5, modifies: 0, reverts: 0, share: 0.09, isFocused: false },
    { fileName: "src/payment/service.ts",tokens:   840_000, reads:  3, modifies: 0, reverts: 0, share: 0.06, isFocused: false },
  ],

  tools: [
    { tool: "read", calls: 48, costUsd: 14.4, deadRatio: 0.10, outputKbP50:  8, outputKbP95: 32 },
    { tool: "grep", calls: 31, costUsd:  4.6, deadRatio: 0.38, outputKbP50:  2, outputKbP95: 12 },
    { tool: "bash", calls: 22, costUsd:  6.6, deadRatio: 0.05, outputKbP50: 12, outputKbP95: 88 },
    { tool: "edit", calls: 18, costUsd:  2.1, deadRatio: 0.00, outputKbP50:  1, outputKbP95:  4 },
    { tool: "task", calls:  5, costUsd:  6.5, deadRatio: 0.20, outputKbP50:  4, outputKbP95: 14 },
  ],

  testLogBloat: {
    rawBytes: 1 * 1024 * 1024 + 240 * 1024,
    compressedBytes: 92 * 1024,
    savingsPct: 92.6,
    topRecurringFailures: [
      { message: "subject id missing in audit", count: 3 },
      { message: "policy decision serialized incorrectly", count: 1 },
    ],
  },

  planAdherence: {
    plannedSteps: 6,
    actualSteps: 11,
    plannedFiles: 4,
    actualFiles: 7,
    adherence: 0.62,
    unplannedFiles: ["src/audit/writer.ts", "src/payment/service.ts", "test/authz.test.ts"],
    label: "drift",
  },

  knowledgeSpread: {
    startedDomains: ["auth/"],
    currentDomains: [
      { domain: "auth/",     touchPct: 0.55, growthPerHour: 0.6 },
      { domain: "audit/",    touchPct: 0.18, growthPerHour: 0.4 },
      { domain: "payment/",  touchPct: 0.14, growthPerHour: 0.3 },
      { domain: "tests/",    touchPct: 0.13, growthPerHour: 0.2 },
    ],
    spreadIndex: 0.54,
  },

  compaction: {
    events: [{ at: "08:14", droppedKb: 7, topics: ["test failure log"] }],
    regenTokens: 7_000,
    regenCostUsd: 2.1,
  },

  streaming: { cancelledTokens: 24_000, cancelledCalls: 2, wallClockWastedMs: 6_000, reason: "user navigated away mid-call" },

  reproducibility: {
    sampledCalls: 18,
    divergentCalls: 2,
    divergencePct: 11.1,
    suspectedCause: "router fell back once at 06:14 (Opus capacity)",
  },

  replay: [
    { at: "00:00", kind: "plan",    actor: "planner",      label: "plan: tighten authorize() — 4 files",                                  costUsd: 0.4 },
    { at: "00:21", kind: "tool",    actor: "coder",        label: "Read security.py (full file)",                                          costUsd: 0.6, touchesFocusedFile: true },
    { at: "00:42", kind: "edit",    actor: "coder",        label: "Edit security.py:authorize — capture subject id",                       costUsd: 1.4, touchesFocusedFile: true },
    { at: "01:18", kind: "test",    actor: "tester",       label: "pnpm test authz → FAIL (subject id missing in audit)",                  costUsd: 0.7 },
    { at: "01:38", kind: "edit",    actor: "coder",        label: "Edit src/audit/writer.ts — accept subject id",                          costUsd: 0.9 },
    { at: "02:14", kind: "test",    actor: "tester",       label: "rerun → 1 fail remaining (policy serialization)",                       costUsd: 0.6 },
    { at: "03:01", kind: "review",  actor: "security",     label: "static scan: clean",                                                    costUsd: 1.1 },
    { at: "06:14", kind: "alert",   actor: "system",       label: "router fallback Opus → Sonnet (capacity); 1 div detected",              costUsd: 0.0 },
    { at: "08:14", kind: "compact", actor: "system",       label: "auto-compaction — 7 KB dropped (test log)",                              costUsd: 0.0 },
    { at: "11:00", kind: "edit",    actor: "coder",        label: "Edit security.py:audit — drop legacy bypass branch",                    costUsd: 1.2, touchesFocusedFile: true },
    { at: "14:42", kind: "review",  actor: "reviewer",     label: "request: also check src/payment/service.ts (scope drift advised)",      costUsd: 1.4 },
  ],

  budget: { maxCostUsd: 80, maxRetries: 3, maxFilesRead: 30, maxWallMinutes: 90, onBreach: "summarize-and-require-approval" },

  violations: [
    { id: "v-s-1", guard: "maxRetries", observed: "3", threshold: "3", status: "armed" },
  ],

  recommendations: secRecommendations,

  tasks: secTasks,
};

const secReport: TokenRadarReport = {
  fileName: "security.py",
  run: secRun,
  fileTouchingTaskIds: ["TASK-24", "TASK-25"],
  fileStats: { fileName: "security.py", tokens: 6_280_000, reads: 12, modifies: 6, reverts: 1, share: 0.45, isFocused: true },
};

/* ─── Registry + lookup ──────────────────────────────────────────────── */

export const TOKEN_RADAR_REPORTS: Record<string, TokenRadarReport> = {
  "orchestrator.py":   orchReport,
  "routing_policy.py": routReport,
  "security.py":       secReport,
};

export function getTokenRadarReport(fileName: string): TokenRadarReport | null {
  return TOKEN_RADAR_REPORTS[fileName] ?? null;
}
