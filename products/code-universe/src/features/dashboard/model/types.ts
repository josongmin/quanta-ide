// Dashboard — data contract
// --------------------------------------------------------------------
// Types shared by the 4 sub-tabs (Repo Health / This Change / Team Flow /
// Governance). Keeping them here in one file so the UI + compute layers
// speak the same vocabulary.
//
// Design note — every metric carries its own confidence chip and optional
// `status: "missing"` so the tab can render a "connect X" empty card
// without the parent needing to know which data sources are wired.

export type DashboardTab =
  | "repo-health"
  | "this-change"
  | "team-flow"
  | "governance";

export type Confidence = "HIGH" | "MED" | "LOW";

export type Sentiment = "good" | "bad" | "neutral";

export type Trend = "up" | "down" | "flat";

export type MetricStatus = "enabled" | "missing";

/** One displayed metric — a single scalar with its formatting + meta. */
export interface Metric {
  label: string;
  value: string;
  raw?: number;
  unit?: string;
  delta?: number;
  deltaLabel?: string;
  trend?: Trend;
  /** Affects accent colour. "bad" = tint danger, "good" = tint success. */
  sentiment?: Sentiment;
  confidence: Confidence;
  /** Short why-this-confidence string, shown on hover. */
  confidenceReason?: string;
  /** Optional inline sparkline — normalised 0..1 points. */
  sparkline?: readonly number[];
  /** "missing" renders a dim connect-X empty card instead of a value. */
  status?: MetricStatus;
  enableHint?: string;
  /** Free-form sub-text under the value, one short line. */
  hint?: string;
}

// ── Repo Health (L2 Baseline Risk) ───────────────────────────────────

export interface RiskBucket {
  bucket: "low" | "medium" | "high";
  count: number;
}

export interface TopRiskFile {
  id: string;
  name: string;
  path: string;
  score: number;
  loc: number;
  layer: string;
  reasons: readonly string[];
}

export interface SmellSlice {
  kind: string;
  label: string;
  count: number;
  color: string;
}

export interface RepoHealthData {
  baselineRisk: {
    score: number;
    bucket: "low" | "medium" | "high";
    confidence: Confidence;
    topContributors: readonly { label: string; weight: number }[];
  };
  primaryMetrics: readonly Metric[];
  structuralMetrics: readonly Metric[];
  semanticMetrics: readonly Metric[];
  confidenceMetrics: readonly Metric[];
  riskDistribution: readonly RiskBucket[];
  topRiskFiles: readonly TopRiskFile[];
  smellBreakdown: readonly SmellSlice[];
  debtSeries: readonly { label: string; points: readonly number[]; latest: number; delta: number; color: string }[];
  hasHistory: boolean;
}

// ── This Change (L3 Delta + L4 Process) ──────────────────────────────

export interface ChangeScope {
  id: string | null;
  kind: "repo" | "folder" | "file" | "symbol";
  name: string;
  path: string;
}

export interface BlastRing {
  depth: number;
  count: number;
}

export interface ThisChangeData {
  scope: ChangeScope;
  hasSelection: boolean;
  deltaRisk: {
    score: number;
    bucket: "low" | "medium" | "high";
    confidence: Confidence;
    category: "Proven" | "High-confidence" | "Speculative";
  };
  blastMetrics: readonly Metric[];
  rings: readonly BlastRing[];
  crossServiceEdges: readonly { from: string; to: string; kind: string }[];
  callGraph: readonly Metric[];
  semanticDiff: readonly Metric[];
  contractBreak: readonly Metric[];
  processRisk: readonly Metric[];
}

// ── Team Flow (L1 DORA) ──────────────────────────────────────────────

export interface TeamContributor {
  author: string;
  filesTouched: number;
  percent: number;
  lastActiveAt: number | null;
}

export interface TeamFlowData {
  doraMetrics: readonly Metric[];
  prMetrics: readonly Metric[];
  flowScore: Metric;
  activeAuthors7d: Metric;
  activeAuthors30d: Metric;
  topContributors: readonly TeamContributor[];
  weeklyActivity: readonly { weekStart: number; commits: number; authors: number }[];
  hasBlame: boolean;
}

// ── Governance (L5) ──────────────────────────────────────────────────

export type AdmissionDecision = "PASS" | "HOLD" | "BLOCK" | "REVIEW";

export interface PolicyHit {
  ruleId: string;
  label: string;
  severity: "low" | "medium" | "high" | "critical";
  count: number;
  color: string;
}

export interface GovernanceEvent {
  id: string;
  at: number;
  kind: string;
  summary: string;
  severity: "low" | "medium" | "high" | "critical" | "info";
  file?: string;
}

export interface GovernanceData {
  verdict: {
    decision: AdmissionDecision;
    totalRisk: number;
    confidence: Confidence;
    topReasons: readonly string[];
    actionsToPass: readonly string[];
  };
  coverageMetrics: readonly Metric[];
  policyMetrics: readonly Metric[];
  trustMetrics: readonly Metric[];
  policyHits: readonly PolicyHit[];
  recentEvents: readonly GovernanceEvent[];
  verdictDistribution: readonly { decision: AdmissionDecision; count: number }[];
}

// ── Top-level layout ─────────────────────────────────────────────────

export interface DashboardLayout {
  width: number;
  height: number;
  scope: ChangeScope;
  repoHealth: RepoHealthData;
  thisChange: ThisChangeData;
  teamFlow: TeamFlowData;
  governance: GovernanceData;
  generatedAt: number;
}
