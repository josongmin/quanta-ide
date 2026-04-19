import type { FeatureDescriptor } from "../feature-registry-types";

// Review flows (Batch 4) — voting, estimation poker,
// retrospective, and kanban lanes.
export const reviewFeatures: readonly FeatureDescriptor[] = [
  {
    id: "review.voting",
    category: "review",
    label: "Dot voting",
    description: "Team voting dots on files / stickies (retro-style).",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "batch-4",
  },
  {
    id: "review.poker",
    category: "review",
    label: "Estimation poker",
    description: "Per-file effort estimate cards (Fibonacci deck).",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "batch-4",
  },
  {
    id: "review.retrospective",
    category: "review",
    label: "Retrospective board",
    description: "Went-well / didn't / action 3-column overlay.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "batch-4",
  },
  {
    id: "review.kanban",
    category: "review",
    label: "Kanban swim lanes",
    description: "File PR review state: Todo / Review / Approved lanes.",
    defaultEnabled: false,
    maturity: "experimental",
    introducedIn: "batch-4",
  },
];
