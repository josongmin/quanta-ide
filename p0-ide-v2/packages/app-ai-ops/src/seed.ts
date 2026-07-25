import type { FeatureManifest } from "@quanta/shell-contract";
import { tabBus } from "@quanta/shell/stores/tab-bus";

export const AI_OPS_FEATURES: readonly FeatureManifest[] = [
  {
    id: "ai-ops",
    title: "AI Ops",
    description:
      "Agent runtime / model / budget / task / policy / diff views — everything that does NOT belong inside the Code Universe canvas.",
    category: "intelligence",
    visibility: "user",
    version: "0.1.0",
    badge: "new",
    commands: [
      {
        id: "ai-ops.open",
        title: "Open AI Ops",
        keybinding: "⌘⇧O",
        description: "Open the runtime / model / budget / task control plane.",
        run: () => tabBus.open("ai-ops", "AI Ops"),
      },
    ],
  },
];
