import { featureRegistry, type FeatureManifest } from "@quanta/shell/stores/feature-registry";
import { uiBus } from "@quanta/shell/stores/ui-bus";
import { shortcutRegistry } from "@quanta/shell/stores/shortcut-registry";

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

/** Register an array of feature manifests + their keybindings. */
export function registerFeatureManifests(features: readonly FeatureManifest[]): void {
  for (const f of features) {
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

export function seedFeatures(): void {
  if (seeded) return;
  seeded = true;
  registerFeatureManifests(SHELL_FEATURES);
}
