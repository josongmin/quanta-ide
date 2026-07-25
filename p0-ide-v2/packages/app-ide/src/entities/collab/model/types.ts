/* ══════════════════════════════════════════════════════════════
   collab/model/types.ts — Collaboration Orchestrator entity
   Reviewer-routing facts: blame × expertise × queue × TZ.
   ══════════════════════════════════════════════════════════════ */

export interface ReviewerCandidate {
  id: string;
  /** Display handle, e.g. "@songmin" */
  handle: string;
  /** Team slug, e.g. "platform" */
  team: string;
  /** IANA timezone, e.g. "Asia/Seoul" */
  tz: string;
  /** Percentage of changed lines authored by this reviewer (0–100). */
  blameMatchPct: number;
  /** Domain proficiency on touched symbols/packages, rolling 90d (0–100). */
  expertise90d: number;
  /** Number of PRs currently in their review queue. */
  pursuingQueue: number;
  /** Soft cap on simultaneous review load. */
  queueCapacity: number;
  /** How many times they reviewed this file in the last 30d. */
  recentReviewsThisFile30d: number;
  /** Hours of TZ overlap with the author today. */
  tzOverlapHrs: number;
  /** True if currently on rotation. */
  onCall?: boolean;
  /** True if marked OOO; routing should heavily penalise. */
  outOfOffice?: boolean;
  /** Composite weighted score (0–100). */
  score: number;
  /** Ordered, human-readable explainability strings. */
  reasons: string[];
}

export interface TeamLoad {
  team: string;
  members: number;
  totalQueue: number;
  totalCapacity: number;
  /** queue/capacity × 100 (>100 = overloaded). */
  loadPct: number;
}

export interface CollabReport {
  fileName: string;
  authorHandle: string;
  authorTz: string;
  /** Pre-sorted by score desc. */
  candidates: ReviewerCandidate[];
  /** Recommended reviewer ids (top-K). */
  recommendedTopK: string[];
  teamLoad: TeamLoad[];
  /** Team slugs whose loadPct > 100. */
  bottleneckTeams: string[];
}
