/**
 * TokenRadar — entity model.
 *
 * Real-time observability + control for AI coding agents:
 *   - cost / cache / model right-sizing  (TIER 1 — direct ROI)
 *   - subagent tree, retry / stuck / pingpong loops (TIER 2 — failure modes)
 *   - waste attribution, hotspots, test-log bloat   (TIER 2 — cost shaping)
 *   - plan adherence, scope drift, compaction loss  (TIER 3 — drift signals)
 *   - replay timeline, budget guard, recommendations (control plane)
 *
 * Per-file report mounts the most-recent run that touched the focused file,
 * with file-specific stats overlaid (hotspot rank, repetition, attribution).
 */

/* ─────────────────────────────────────────────────────────────
   Run-level core
   ───────────────────────────────────────────────────────────── */

export type RunStatus = "running" | "merged" | "failed" | "stuck" | "paused";
export type Tier = "t1" | "t2" | "t3";

export type ModelId =
  | "claude-opus-4-7"
  | "claude-sonnet-4-6"
  | "claude-haiku-4-5"
  | "gpt-4.1"
  | "internal-router";

export type AgentRole =
  | "orchestrator"
  | "planner"
  | "coder"
  | "reviewer"
  | "tester"
  | "fixer"
  | "summarizer"
  | "security"
  | "doc";

/* ─────────────────────────────────────────────────────────────
   Task cost + tasks list (the table the user sees first)
   ───────────────────────────────────────────────────────────── */

export interface TaskCost {
  taskId: string;
  title: string;
  status: RunStatus;
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  cachedTokens: number;
  costUsd: number;
  toolCalls: number;
  retries: number;
  durationMs: number;
  /** present if this task touches the focused file */
  touchesFocusedFile: boolean;
  /** "A".."F" — see DiffEfficiency */
  efficiencyGrade: EfficiencyGrade;
  /** 0..1 — likelihood the task is in a stuck loop */
  stuckness: number;
}

/* ─────────────────────────────────────────────────────────────
   TIER 1 — Cache & Model right-sizing
   ───────────────────────────────────────────────────────────── */

export interface CacheBreakpointSuggestion {
  /** human label of the prompt segment */
  label: string;
  /** how many calls referenced this segment */
  uses: number;
  /** 0..1 — how many of those uses were cache hits */
  hitRatio: number;
  /** estimated savings if we add a cache_control breakpoint here */
  savingsUsd: number;
  /** "stable" — segment hash is constant; or "drift" — content rotates and is poor cache target */
  stability: "stable" | "drift";
}

export interface CacheReport {
  /** 0..1 */
  hitRatio: number;
  cachedTokens: number;
  uncachedTokens: number;
  /** dollars left on the table over the last 24h */
  estimatedDailySavingsUsd: number;
  suggestions: CacheBreakpointSuggestion[];
}

export interface ModelCallSlice {
  model: ModelId;
  calls: number;
  costUsd: number;
}

export type RightSizingScore = "A" | "B" | "C" | "D" | "F";

export interface ModelAuditReport {
  totalCalls: number;
  actual: ModelCallSlice[];
  /** what the right-sized split would have been, post-hoc */
  rightSized: ModelCallSlice[];
  overspendUsd: number;
  score: RightSizingScore;
  /** plain-English advice, e.g. "26 review calls could move to Sonnet (-$31)" */
  advice: string[];
}

/* ─────────────────────────────────────────────────────────────
   TIER 1 — Secret egress (compliance)
   ───────────────────────────────────────────────────────────── */

export type SecretSeverity = "critical" | "high" | "medium";

export interface SecretEgressIncident {
  id: string;
  severity: SecretSeverity;
  pattern: string;
  /** redacted snippet */
  preview: string;
  /** file or source descriptor that fed the leak */
  source: string;
  /** ISO timestamp when the leak hit the LLM */
  occurredAt: string;
  /** which agent prompt carried the leak */
  agentRole: AgentRole;
  /** action recommended to user */
  remediation: string;
}

/* ─────────────────────────────────────────────────────────────
   TIER 1 — Subagent tree (Sankey-like flame breakdown)
   ───────────────────────────────────────────────────────────── */

export interface AgentNode {
  id: string;
  role: AgentRole;
  /** human label, e.g. "reviewer:arch" */
  label: string;
  totalTokens: number;
  costUsd: number;
  callCount: number;
  /** 0..1 — share of the parent's cost */
  shareOfParent: number;
  /** anomaly: child cost > parent's other children combined, etc */
  anomalyHint?: string;
  children: AgentNode[];
}

/* ─────────────────────────────────────────────────────────────
   TIER 1 — Cost forecast / ETA
   ───────────────────────────────────────────────────────────── */

export interface ForecastReport {
  burnUsdPerMin: number;
  elapsedMs: number;
  /** projected at-completion cost given current burn */
  projectedTotalUsd: number;
  /** ISO */
  projectedFinishAt: string;
  /** historical baseline for comparable tasks */
  medianSimilarUsd: number;
  p95SimilarUsd: number;
  /** how many σ above the median this run is */
  zScore: number;
  /** "tag" used to find similar tasks */
  comparableTag: string;
  /** sample size for the comparable population */
  similarN: number;
}

/* ─────────────────────────────────────────────────────────────
   TIER 2 — Token flamegraph (role share)
   ───────────────────────────────────────────────────────────── */

export interface FlameSlice {
  role: AgentRole;
  /** 0..1 share of total cost */
  share: number;
  costUsd: number;
  tokens: number;
  /** sub-buckets, e.g. reviewer → "read full file" / "diff review" / "arch comments" */
  subSlices: { label: string; share: number; tokens: number }[];
}

/* ─────────────────────────────────────────────────────────────
   TIER 2 — Retry / Stuck / Pingpong / Convergence
   ───────────────────────────────────────────────────────────── */

export interface RetryLoop {
  taskId: string;
  pattern: string[];
  repeats: number;
  wastedUsd: number;
  /** policy intervention recommendation */
  intervention: string;
}

export interface StucknessReport {
  /** 0..1 */
  probability: number;
  reasons: string[];
  recommendedAction: "continue" | "summarize-and-pause" | "human-review" | "abort";
}

export interface PingpongCycle {
  id: string;
  subjectFile: string;
  subjectLineSpan: string;
  cycles: number;
  /** ordered narrative */
  narrative: { actor: AgentRole; action: "added" | "removed" | "rewritten"; at: string }[];
  resolution: "pending" | "human-required" | "resolved";
}

export interface ConvergenceCurve {
  /** time labels (min:sec since start) */
  ticks: string[];
  failures: number[];
  /** absolute lines added+deleted in that interval (churn) */
  churn: number[];
  rejections: number[];
}

/* ─────────────────────────────────────────────────────────────
   TIER 2 — Waste attribution (donut)
   ───────────────────────────────────────────────────────────── */

export type WasteCategory =
  | "repeated_context"
  | "failed_retries"
  | "overbroad_review"
  | "full_file_reads"
  | "test_log_bloat"
  | "unclear_task_scope"
  | "cancelled_streams"
  | "compaction_regen";

export interface WasteSlice {
  category: WasteCategory;
  percent: number;
  usd: number;
  /** how to fix this category */
  fix: string;
}

/* ─────────────────────────────────────────────────────────────
   TIER 2 — Context leak detector
   ───────────────────────────────────────────────────────────── */

export interface ContextLeak {
  id: string;
  source: string;
  /** how many calls injected this same content */
  injections: number;
  /** size of the recurring chunk in KB */
  sizeKb: number;
  /** wasted dollars from un-cached repeats */
  wastedUsd: number;
  /** 0..1 — duplicate share within the offending prompts */
  repetitionRatio: number;
  recommendation: string;
}

/* ─────────────────────────────────────────────────────────────
   TIER 2 — Diff efficiency + churn
   ───────────────────────────────────────────────────────────── */

export type EfficiencyGrade = "A" | "B" | "C" | "D" | "F";

export interface DiffEfficiencyReport {
  totalTokens: number;
  linesChanged: number;
  tokensPerLoc: number;
  grade: EfficiencyGrade;
  /** verbal label, e.g. "wasteful", "productive" */
  label: string;
  /** distribution comparison vs comparable tasks */
  percentile: number;
}

export interface DiffChurnReport {
  linesAdded: number;
  linesDeleted: number;
  /** lines added then later deleted in the same run */
  reAdded: number;
  reverted: number;
  /** churn ratio = (added+deleted) / (net diff) */
  churnRatio: number;
  /** dollars spent on churn (added-and-then-removed) */
  churnUsd: number;
}

/* ─────────────────────────────────────────────────────────────
   TIER 2 — File hotspots + tool ROI + test bloat
   ───────────────────────────────────────────────────────────── */

export interface FileHotspot {
  fileName: string;
  tokens: number;
  reads: number;
  modifies: number;
  reverts: number;
  /** 0..1 — share of run cost */
  share: number;
  /** marks the focused file in the ranking */
  isFocused: boolean;
}

export type ToolName = "read" | "grep" | "bash" | "edit" | "web" | "task";

export interface ToolStat {
  tool: ToolName;
  calls: number;
  costUsd: number;
  /** 0..1 — calls whose output was never referenced in subsequent action */
  deadRatio: number;
  /** median KB injected back to context per call */
  outputKbP50: number;
  outputKbP95: number;
}

export interface TestLogBloatReport {
  rawBytes: number;
  compressedBytes: number;
  savingsPct: number;
  topRecurringFailures: { message: string; count: number }[];
}

/* ─────────────────────────────────────────────────────────────
   TIER 3 — Plan adherence + scope drift
   ───────────────────────────────────────────────────────────── */

export interface PlanAdherenceReport {
  plannedSteps: number;
  actualSteps: number;
  plannedFiles: number;
  actualFiles: number;
  /** 0..1 — adherence (1 = perfect match) */
  adherence: number;
  /** unexpected files that ended up touched */
  unplannedFiles: string[];
  label: "on-plan" | "drift" | "scope-creep" | "runaway";
}

export interface KnowledgeDomain {
  /** dir / package label */
  domain: string;
  /** 0..1 — share of files touched in this domain */
  touchPct: number;
  /** new files added per hour in this domain */
  growthPerHour: number;
}

export interface KnowledgeSpreadReport {
  startedDomains: string[];
  currentDomains: KnowledgeDomain[];
  /** 0..1 — spread velocity heuristic */
  spreadIndex: number;
}

/* ─────────────────────────────────────────────────────────────
   TIER 3 — Compaction / Streaming / Reproducibility
   ───────────────────────────────────────────────────────────── */

export interface CompactionLossReport {
  events: { at: string; droppedKb: number; topics: string[] }[];
  regenTokens: number;
  regenCostUsd: number;
}

export interface StreamingWasteReport {
  cancelledTokens: number;
  cancelledCalls: number;
  wallClockWastedMs: number;
  reason: string;
}

export interface ReproducibilityReport {
  sampledCalls: number;
  divergentCalls: number;
  divergencePct: number;
  /** suspected cause, e.g. "model rolled mid-run", "router fell back" */
  suspectedCause: string;
}

/* ─────────────────────────────────────────────────────────────
   Replay timeline
   ───────────────────────────────────────────────────────────── */

export type ReplayKind =
  | "plan"
  | "edit"
  | "test"
  | "review"
  | "rollback"
  | "alert"
  | "tool"
  | "compact"
  | "human";

export interface ReplayEvent {
  /** mm:ss since run start */
  at: string;
  kind: ReplayKind;
  actor: AgentRole | "system" | "human";
  label: string;
  /** optional cost increment caused by this event */
  costUsd?: number;
  /** optional inline detail (e.g. test failure message) */
  detail?: string;
  /** boolean: whether this event touches the focused file */
  touchesFocusedFile?: boolean;
}

/* ─────────────────────────────────────────────────────────────
   Policy / control plane
   ───────────────────────────────────────────────────────────── */

export interface BudgetGuard {
  /** dollars */
  maxCostUsd: number;
  maxRetries: number;
  maxFilesRead: number;
  maxWallMinutes: number;
  /** what to do on breach */
  onBreach: "pause" | "summarize-and-require-approval" | "abort";
}

export interface PolicyViolation {
  id: string;
  guard: keyof BudgetGuard;
  observed: string;
  threshold: string;
  status: "armed" | "tripped" | "auto-paused";
}

export interface Recommendation {
  id: string;
  /** which feature surfaces this — used for cross-linking */
  origin:
    | "cache"
    | "model"
    | "subagent"
    | "retry"
    | "stuck"
    | "pingpong"
    | "context"
    | "hotspot"
    | "tool"
    | "diff"
    | "plan"
    | "scope"
    | "compaction"
    | "secret"
    | "policy";
  severity: "info" | "advice" | "warn" | "critical";
  /** a punchy one-liner */
  title: string;
  /** the cost saving / risk reduction estimate */
  impact: string;
  /** more verbose body */
  body: string;
}

/* ─────────────────────────────────────────────────────────────
   Aggregate run + per-file report
   ───────────────────────────────────────────────────────────── */

export interface AgentRun {
  runId: string;
  startedAt: string;
  status: RunStatus;
  /** ms */
  elapsedMs: number;
  /** core counters (header) */
  totalTokens: number;
  inputTokens: number;
  outputTokens: number;
  costUsd: number;
  toolCalls: number;
  retries: number;
  taskCount: number;

  /* TIER 1 */
  cache: CacheReport;
  modelAudit: ModelAuditReport;
  secretEgress: SecretEgressIncident[];
  agentTree: AgentNode;
  forecast: ForecastReport;

  /* TIER 2 — flame, loops, waste, hotspots */
  flame: FlameSlice[];
  retryLoops: RetryLoop[];
  stuckness: StucknessReport;
  pingpong: PingpongCycle[];
  convergence: ConvergenceCurve;
  waste: WasteSlice[];
  contextLeaks: ContextLeak[];
  diffEfficiency: DiffEfficiencyReport;
  diffChurn: DiffChurnReport;
  fileHotspots: FileHotspot[];
  tools: ToolStat[];
  testLogBloat: TestLogBloatReport;

  /* TIER 3 — drift */
  planAdherence: PlanAdherenceReport;
  knowledgeSpread: KnowledgeSpreadReport;
  compaction: CompactionLossReport;
  streaming: StreamingWasteReport;
  reproducibility: ReproducibilityReport;

  /* timeline + control plane */
  replay: ReplayEvent[];
  budget: BudgetGuard;
  violations: PolicyViolation[];
  recommendations: Recommendation[];

  /* tasks list */
  tasks: TaskCost[];
}

export interface TokenRadarReport {
  fileName: string;
  /** the most recent agent run that touched this file */
  run: AgentRun;
  /** subset of run.tasks that touch this file */
  fileTouchingTaskIds: string[];
  /** this file's stats inside the run (mirror of fileHotspots focused entry) */
  fileStats: FileHotspot;
}
