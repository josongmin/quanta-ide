import type { FeatureManifest } from "@quanta/shell-contract";
import { tabBus } from "@/shared/model/tab-bus";

/**
 * Agent app feature manifests.
 *
 * Phase A: imported from `@/` paths. Phase B will co-locate stores.
 */
export const AGENT_FEATURES: readonly FeatureManifest[] = [
  {
    id: "ai-coding-agent",
    title: "AI Coding Agent",
    description: "Start a coding session with full engine context injected.",
    category: "workflow",
    visibility: "user",
    version: "0.1.0",
    primary: {
      tileLabel: "AI Coding Agent",
      tileHint: "⌘J",
      tileRun: () => tabBus.open("agent", "Agent Session"),
    },
  },
];
