import type { FeatureDescriptor } from "../feature-registry-types";

// Smart embeds (Batch 8) — paste-image elements, ticket cards, PR badges,
// Slack thread cards.
export const embedsFeatures: readonly FeatureDescriptor[] = [
  {
    id: "embeds.imagePaste",
    category: "embeds",
    label: "Paste image as element",
    description: "Clipboard paste of an image drops it on the canvas as a world-positioned, draggable image element (persisted in localStorage).",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "batch-8",
  },
  {
    id: "embeds.tickets",
    category: "embeds",
    label: "Ticket cards (Linear / Jira / GitHub)",
    description: "Mock ticket cards linked to files (Linear / Jira / GitHub) — displayed adjacent to each file at city+ zoom.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "batch-8",
  },
  {
    id: "embeds.prBadge",
    category: "embeds",
    label: "Pull-request badges",
    description: "Mock open / merged PRs as a top-left pill on file cards; hover shows title, stats, and a mini diff preview.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "batch-8",
  },
  {
    id: "embeds.slackThread",
    category: "embeds",
    label: "Slack thread embed",
    description: "Mock Slack thread cards pinned to the right edge of each linked file (city+ zoom). Threads without a resolved file collapse into a bottom-left stack.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "batch-8",
  },
];
