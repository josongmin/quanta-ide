import type { FeatureManifest } from "@quanta/shell-contract";
import { tabBus } from "@quanta/shell/stores/tab-bus";

/**
 * Scenario app feature manifests.
 *
 * Phase A: imported from `@/` paths. Phase B will co-locate stores.
 */
export const SCENARIO_FEATURES: readonly FeatureManifest[] = [
  {
    id: "counterfactual",
    title: "Counterfactual Projection",
    description:
      "Engine-projected trajectory of risk, blast, cpx, coverage and incident probability over 7/14/30/90 days.",
    category: "intelligence",
    visibility: "user",
    version: "0.1.0",
    badge: "new",
    commands: [
      {
        id: "scenario.open",
        title: "Open Scenario workspace",
        keybinding: "⌘⇧C",
        run: () => tabBus.open("scenario", "Scenario · execute()"),
      },
    ],
  },
];
