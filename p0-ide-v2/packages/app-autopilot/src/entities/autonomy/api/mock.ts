import type { AutonomyProfile } from "../model/types";

export const AUTONOMY_PROFILES: readonly AutonomyProfile[] = [
  {
    id: "safe_production",
    name: "Safe Production",
    level: 3,
    description:
      "Mechanical, low-risk work. Tests, dead code, safe rename, import cleanup. Autopilot files PRs directly.",
    executionMode: "autonomous",
    allowedRisk: ["low"],
    requiresCheckpointReview: false,
    allowsAutoPr: true,
    allowsContinuousRuns: true,
  },
  {
    id: "senior_guided_refactor",
    name: "Senior-Guided Refactor",
    level: 2,
    description:
      "Bounded structural work. A senior sets intent, sequencing, and forbidden zones. Autopilot runs; checkpoints before merge.",
    executionMode: "guided",
    allowedRisk: ["low", "medium"],
    requiresCheckpointReview: true,
    allowsAutoPr: true,
    allowsContinuousRuns: false,
  },
  {
    id: "interactive_editor",
    name: "Interactive Editor",
    level: 1,
    description:
      "Pair mode. Autopilot suggests; the engineer applies. Useful during design-sensitive work and exploration.",
    executionMode: "interactive",
    allowedRisk: ["low", "medium", "high"],
    requiresCheckpointReview: false,
    allowsAutoPr: false,
    allowsContinuousRuns: false,
  },
  {
    id: "observe_only",
    name: "Observe Only",
    level: 0,
    description:
      "No mutations. Autopilot watches drift and surfaces opportunities; no patches, no PRs.",
    executionMode: "observe",
    allowedRisk: [],
    requiresCheckpointReview: false,
    allowsAutoPr: false,
    allowsContinuousRuns: true,
  },
];
