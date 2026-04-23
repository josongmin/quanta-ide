import type { FeatureManifest } from "@quanta/shell-contract";
import { tabBus } from "@quanta/shell/stores/tab-bus";

/**
 * Autopilot (Autonomous Repo Engineer) feature manifests.
 *
 * Exposes the top-level entry + command-palette actions that jump
 * straight into specific surfaces (goals / runs / opportunities / operators).
 */
export const AUTOPILOT_FEATURES: readonly FeatureManifest[] = [
  {
    id: "autopilot",
    title: "Autopilot",
    description:
      "Autonomous Repo Engineer — goals, opportunities, runs, and verifier-backed proofs. Goal-driven + opportunity-driven execution under adjustable autonomy.",
    category: "workflow",
    visibility: "user",
    version: "0.1.0",
    badge: "new",
    primary: {
      tileLabel: "Autopilot",
      tileHint: "⌘⌥A",
      tileRun: () => tabBus.open("autopilot", "Autopilot"),
    },
    commands: [
      {
        id: "autopilot.open",
        title: "Open Autopilot",
        keybinding: "⌘⌥A",
        description: "Open the Autopilot overview (Autonomous Repo Engineer).",
        run: () => tabBus.open("autopilot", "Autopilot"),
      },
      {
        id: "autopilot.open-goals",
        title: "Autopilot: Open Goals",
        keybinding: "⌘⌥G",
        description: "Jump to the goals index.",
        run: () =>
          tabBus.open("autopilot", "Autopilot · Goals", {
            route: { path: ["goals"] },
          }),
      },
      {
        id: "autopilot.open-runs",
        title: "Autopilot: Open Runs",
        keybinding: "⌘⌥R",
        description: "Jump to the runs list.",
        run: () =>
          tabBus.open("autopilot", "Autopilot · Runs", {
            route: { path: ["runs"] },
          }),
      },
      {
        id: "autopilot.open-opportunities",
        title: "Autopilot: Open Opportunities",
        description: "Jump to the opportunity queue.",
        run: () =>
          tabBus.open("autopilot", "Autopilot · Opportunities", {
            route: { path: ["opportunities"] },
          }),
      },
    ],
    settings: [
      {
        key: "autopilot.allowAutoMergeSafeLane",
        label: "Allow auto-merge on safe-production profile",
        type: "boolean",
        default: false,
        description:
          "When enabled, autopilot may merge verifier-backed, low-risk PRs without human approval.",
      },
      {
        key: "autopilot.proofCanonicalSurface",
        label: "Canonical proof surface",
        type: "enum",
        default: "app-reviews",
        enumValues: ["app-reviews", "app-pr", "inline"],
        description: "Which surface renders ProofArtifact details.",
      },
    ],
  },
];
