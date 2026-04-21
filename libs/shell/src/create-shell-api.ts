import type { ShellAPI, TabApp } from "@quanta/shell-contract";
import { toast } from "@quanta/shell/stores/toast-store";
import { uiBus } from "@quanta/shell/stores/ui-bus";
import { shortcutRegistry } from "@quanta/shell/stores/shortcut-registry";
import { featureRegistry } from "@quanta/shell/stores/feature-registry";
import { overlayRegistry } from "./overlay-registry";

interface TabActions {
  openTab: (app: TabApp, label: string) => void;
  closeTab: (id: string) => void;
  selectTab: (id: string) => void;
}

export function createShellAPI(tabActions: TabActions): ShellAPI {
  return {
    openTab: (app, label) => tabActions.openTab(app, label),
    closeTab: (id) => tabActions.closeTab(id),
    selectTab: (id) => tabActions.selectTab(id),

    toast: {
      success: (msg) => { toast.success(msg); },
      error: (msg) => { toast.danger(msg); },
      info: (msg) => { toast.info(msg); },
    },

    togglePalette: () => uiBus.togglePalette(),
    toggleDevConsole: () => uiBus.toggleDevConsole(),
    toggleSettings: () => uiBus.toggleSettings(),
    toggleDashboard: () => uiBus.toggleDashboard(),
    toggleRules: (open) => uiBus.toggleRules(open),

    theme: {
      current: "light",
      toggle: () => { /* TODO: wire to real theme store */ },
    },

    registerFeatures: (manifests) => {
      for (const m of manifests) featureRegistry.register(m);
      return () => {
        for (const m of manifests) featureRegistry.unregister(m.id);
      };
    },

    registerShortcuts: (bindings) => {
      const disposers = bindings.map((b) => shortcutRegistry.register(b));
      return () => {
        for (const d of disposers) d();
      };
    },

    registerOverlay: (id, component) => overlayRegistry.register(id, component),
  };
}
