export type InboxItemKind =
  | "review_needed"
  | "auto_run_scheduled"
  | "abandoned"
  | "drift_spike"
  | "new_opportunity"
  | "goal_satisfied"
  | "guarded_lane_promotion";

export type InboxUrgency = "now" | "today" | "watch";

/**
 * 3-slot inbox card payload.
 *
 * RFC mandates every inbox card answers: what happened / who decided / what's next.
 * Kept intentionally small to force triage-density reads.
 */
export interface InboxItem {
  id: string;
  kind: InboxItemKind;
  urgency: InboxUrgency;
  /** Slot 1 — what happened. One sentence. */
  happened: string;
  /** Slot 2 — who/what decided. Operator, planner, human. */
  decidedBy: string;
  /** Slot 3 — what's next. The single action. */
  nextAction: string;
  /** Deep link target. */
  target?:
    | { kind: "run"; id: string }
    | { kind: "goal"; id: string }
    | { kind: "proof"; id: string }
    | { kind: "opportunity"; id: string }
    | { kind: "workitem"; id: string };
  createdAt: string;
}
