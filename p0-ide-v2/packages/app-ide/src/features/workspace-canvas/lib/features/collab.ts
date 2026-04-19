import type { FeatureDescriptor } from "../feature-registry-types";

// Collab (Batch 1) — multiplayer presence, cursors, follow-mode, comments,
// reactions, and element locking. All OFF by default because they spawn
// mock agents / cursors that surprise first-time users.
export const collabFeatures: readonly FeatureDescriptor[] = [
  {
    id: "collab.presence",
    category: "collab",
    label: "Agent presence rings",
    description: "Pulsing rings around files each agent is currently viewing.",
    defaultEnabled: false,
    maturity: "stable",
    introducedIn: "stage-6",
  },
  {
    id: "collab.cursors",
    category: "collab",
    label: "Realtime cursors",
    description: "Other viewers' cursors rendered in world coords with name tags.",
    defaultEnabled: false,
    maturity: "beta",
    dependsOn: ["collab.presence"],
    introducedIn: "batch-1",
  },
  {
    id: "collab.follow",
    category: "collab",
    label: "Follow mode",
    description: "Snap your viewport to another viewer's camera.",
    defaultEnabled: false,
    maturity: "beta",
    dependsOn: ["collab.cursors"],
    introducedIn: "batch-1",
  },
  {
    id: "collab.comments",
    category: "collab",
    label: "Comment threads",
    description: "Pin threaded comments to files / edges with resolve + @mention.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "batch-1",
  },
  {
    id: "collab.reactions",
    category: "collab",
    label: "Emoji reactions",
    description: "Drop quick emoji reactions on files, edges, or stickies.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "batch-1",
  },
  {
    id: "collab.lock",
    category: "collab",
    label: "Lock element",
    description: "Prevent others from moving or editing a sticky / annotation.",
    defaultEnabled: false,
    maturity: "beta",
    introducedIn: "batch-1",
  },
];
