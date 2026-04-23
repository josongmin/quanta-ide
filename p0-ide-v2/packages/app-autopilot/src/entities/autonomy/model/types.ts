export type AutonomyLevel = 0 | 1 | 2 | 3 | 4;

export type AutonomyExecutionMode =
  | "observe"
  | "interactive"
  | "guided"
  | "autonomous"
  | "continuous";

export interface AutonomyProfile {
  id: string;
  name: string;
  level: AutonomyLevel;
  description: string;
  executionMode: AutonomyExecutionMode;
  allowedRisk: Array<"low" | "medium" | "high">;
  requiresCheckpointReview: boolean;
  allowsAutoPr: boolean;
  allowsContinuousRuns: boolean;
}

export const AUTONOMY_LEVEL_META: Record<
  AutonomyLevel,
  { title: string; verb: string; tone: "neutral" | "observe" | "assist" | "execute" }
> = {
  0: { title: "Observe", verb: "watches", tone: "observe" },
  1: { title: "Assist", verb: "suggests", tone: "assist" },
  2: { title: "Guided", verb: "executes with checkpoints", tone: "assist" },
  3: { title: "Autonomous", verb: "files PRs on its own", tone: "execute" },
  4: { title: "Continuous", verb: "runs forever", tone: "execute" },
};
