import type { FeatureDescriptor } from "../feature-registry-types";

// AI assist (Batch 6) — NL filter DSL, sticky clustering, repo tour, anomaly
// alerts. All OFF by default (tour launches unprompted, anomaly alerts run
// coupling scans).
export const aiFeatures: readonly FeatureDescriptor[] = [
  {
    id: "ai.naturalLanguageFilter",
    category: "ai",
    label: "Natural-language edge filter",
    description: "Type a plain-English question and the AI compiles it to the DSL.",
    defaultEnabled: false,
    maturity: "experimental",
    introducedIn: "batch-6",
  },
  {
    id: "ai.clusterStickies",
    category: "ai",
    label: "Cluster stickies",
    description: "Group stickies with similar text into labelled clusters.",
    defaultEnabled: false,
    maturity: "experimental",
    introducedIn: "batch-6",
  },
  {
    id: "ai.repoTour",
    category: "ai",
    label: "Repo tour",
    description: "AI-generated guided walk through the most important files.",
    defaultEnabled: false,
    maturity: "experimental",
    introducedIn: "batch-6",
  },
  {
    id: "ai.anomalyAlerts",
    category: "ai",
    label: "Anomaly alerts",
    description: "Badge files with coupling spikes, cycles, or unreachable status.",
    defaultEnabled: false,
    maturity: "experimental",
    introducedIn: "batch-6",
  },
];
