import type { FeatureManifest } from "@quanta/shell-contract";
import { tabBus } from "@quanta/shell/stores/tab-bus";

export const TOKEN_RADAR_FEATURES: readonly FeatureManifest[] = [
  {
    id: "token-radar",
    title: "TokenRadar",
    description:
      "Agent runtime control plane — token cost, cache ROI, model right-sizing, retry / stuck / pingpong loops, context leaks, secret egress, budget guard.",
    category: "intelligence",
    visibility: "user",
    version: "0.1.0",
    badge: "new",
    commands: [
      {
        id: "token-radar.open",
        title: "Open TokenRadar",
        keybinding: "⌘⇧T",
        description:
          "Open the agent runtime dashboard — runs, hotspots, recommendations.",
        run: () => tabBus.open("token-radar", "TokenRadar"),
      },
    ],
    settings: [
      {
        key: "token-radar.budget.maxCostUsd",
        label: "Default budget guard — max cost per run (USD)",
        type: "number",
        default: 80,
      },
      {
        key: "token-radar.budget.maxRetries",
        label: "Default budget guard — max retries per task",
        type: "number",
        default: 3,
      },
      {
        key: "token-radar.policy.autoPauseOnSecretEgress",
        label: "Auto-pause runs that leak secrets",
        type: "boolean",
        default: true,
      },
    ],
  },
];
