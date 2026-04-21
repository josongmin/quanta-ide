import type { FeatureManifest } from "@quanta/shell-contract";
import { uiBus } from "@quanta/shell/stores/ui-bus";

// Dashboard feature manifest.
//
// The Dashboard is an IDE-level overlay (peer to Settings), not a
// per-tab app. It aggregates the 5-layer metrics story — Repo Health
// (L2 baseline), This Change (L3 delta), Team Flow (L1 delivery), and
// Governance (L5 verdict) — in one screen that reviewers and leads can
// open without leaving their current tab.
//
// Entry paths:
//   - Topbar gauge icon (next to Settings)
//   - Command palette → "Open Dashboard"
//   - Feature catalog → primary tile
//   - ⌘⇧D keybinding

export const DASHBOARD_FEATURES: readonly FeatureManifest[] = [
  {
    id: "dashboard",
    title: "Dashboard",
    description:
      "5-layer repo health surface — Flow · Baseline · Delta · Process · Verdict. One screen for 'is the repo safe to ship'.",
    category: "intelligence",
    visibility: "user",
    version: "0.1.0",
    badge: "new",
    primary: {
      tileLabel: "Dashboard",
      tileHint: "⌘⇧D",
      tileRun: () => uiBus.toggleDashboard(true),
    },
    commands: [
      {
        id: "dashboard.open",
        title: "Open Dashboard",
        keybinding: "⌘⇧D",
        description: "Toggle the repo-health dashboard overlay.",
        run: () => uiBus.toggleDashboard(true),
      },
      {
        id: "dashboard.close",
        title: "Close Dashboard",
        description: "Dismiss the dashboard overlay.",
        run: () => uiBus.toggleDashboard(false),
      },
    ],
    shortcuts: [{ key: "mod+shift+d", commandId: "dashboard.open" }],
  },
];
