import { featureRegistry, type FeatureManifest } from "@/shared/model/feature-registry";
import { uiBus } from "@/shared/model/ui-bus";
import { shortcutRegistry } from "@/shared/model/shortcut-registry";

// App-specific features are seeded by each app's seed.ts
// (packages/app-ide, app-agent, app-rules, app-scenario, app-reviews, app-home).
// They will be registered via `useShell().registerFeatures()` when each app mounts (Phase B).

const SHELL_FEATURES: readonly FeatureManifest[] = [
  {
    id: "settings",
    title: "Settings",
    description:
      "Global settings workspace. Aggregates every registered feature's settings into a single Chrome-style tab.",
    category: "workflow",
    visibility: "user",
    version: "0.1.0",
    commands: [
      {
        id: "settings.open",
        title: "Open Settings",
        keybinding: "⌘,",
        run: () => uiBus.toggleSettings(true),
      },
    ],
  },
  {
    id: "dev-console",
    title: "Dev Console",
    description: "Registry, events, and feature graph for internal debugging.",
    category: "integration",
    visibility: "dev-only",
    version: "0.1.0",
    commands: [
      {
        id: "dev.openConsole",
        title: "Open Dev Console",
        keybinding: "⌘⌥⇧D",
        run: () => uiBus.toggleDevConsole(true),
      },
    ],
  },
];

let seeded = false;

export function seedFeatures(): void {
  if (seeded) return;
  seeded = true;
  for (const f of SHELL_FEATURES) {
    featureRegistry.register(f);
    for (const cmd of f.commands ?? []) {
      if (!cmd.keybinding) continue;
      shortcutRegistry.register({
        id: cmd.id,
        keys: cmd.keybinding,
        label: cmd.title,
        run: (e) => {
          e.preventDefault();
          cmd.run();
        },
      });
    }
  }
}
