import type { FeatureManifest } from "@quanta/shell-contract";
import { tabBus } from "@quanta/shell/stores/tab-bus";

export const DEMO_FEATURES: readonly FeatureManifest[] = [
  {
    id: "demo-saas",
    title: "Try demo",
    description:
      "Walk-through of every SaaS surface: auth, billing, team, profile, onboarding, notifications, legal, admin.",
    category: "workflow",
    visibility: "user",
    version: "0.1.0",
    badge: "new",
    commands: [
      {
        id: "demo.open",
        title: "Try demo — open the SaaS walk-through",
        keybinding: "⌘⇧D",
        description: "Open the full set of demo mockups as a dedicated tab.",
        run: () => tabBus.open("demo", "Try demo"),
      },
    ],
  },
];
