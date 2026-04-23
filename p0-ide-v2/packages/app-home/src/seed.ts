import type { FeatureManifest } from "@quanta/shell-contract";
import { tabBus } from "@quanta/shell/stores/tab-bus";

/**
 * Home app feature manifests.
 */
export const HOME_FEATURES: readonly FeatureManifest[] = [
  {
    id: "analysis-catalog-page",
    title: "Analysis Catalog",
    description: "Browse every analysis capability with search, domain/scope filters, and direct open-to-tab actions.",
    category: "intelligence",
    visibility: "user",
    version: "1.0.0",
    badge: "new",
    primary: {
      tileLabel: "Analysis Catalog",
      tileHint: "⌘⇧K",
      tileRun: () => tabBus.open("analysis-catalog", "Analysis Catalog"),
    },
    commands: [
      {
        id: "analysisCatalog.open",
        title: "Open Analysis Catalog",
        keybinding: "⌘⇧K",
        run: () => tabBus.open("analysis-catalog", "Analysis Catalog"),
      },
    ],
  },
];
