import { useEffect } from "react";
import { uiBus } from "@quanta/shell/stores/ui-bus";
import { tabBus } from "@quanta/shell/stores/tab-bus";
import { shortcutRegistry } from "@quanta/shell/stores/shortcut-registry";

/**
 * Register shell-level shortcuts: palette, new tab, and escape cascade
 * for shell-owned modals (palette, dev-console, rules, settings).
 *
 * IDE-specific shortcuts (⌘1 overview, ⌘2-6 modes, ⌘E, ⌘⇧S, ⌘⇧F,
 * and Escape for IDE overlays) are registered by app-ide via
 * `useShell().registerShortcuts()`.
 */
function registerShellShortcuts(): () => void {
  const disposers: Array<() => void> = [];

  const openPalette = (e: KeyboardEvent) => {
    e.preventDefault();
    uiBus.togglePalette(true);
  };

  disposers.push(
    shortcutRegistry.register({
      id: "palette.open.p",
      keys: "mod+p",
      label: "Command Palette",
      run: openPalette,
    }),
    shortcutRegistry.register({
      id: "palette.open.shiftP",
      keys: "mod+shift+p",
      label: "Command Palette",
      run: openPalette,
    }),
    shortcutRegistry.register({
      id: "palette.open.k",
      keys: "mod+k",
      label: "Command Palette",
      run: openPalette,
    }),
    shortcutRegistry.register({
      id: "palette.open.shiftK",
      keys: "mod+shift+k",
      label: "Command Palette",
      run: openPalette,
    }),
    shortcutRegistry.register({
      id: "tabs.newCapabilitiesHub",
      keys: "mod+shift+h",
      label: "New Capabilities Hub tab",
      run: (e) => {
        e.preventDefault();
        tabBus.open("new-tab", "New Tab");
      },
    }),
    shortcutRegistry.register({
      id: "escape.shell",
      keys: "escape",
      label: "Close shell modals",
      ignoreMods: true,
      // Only fire when a shell modal is actually open; otherwise fall through
      // so app-level escape handlers (e.g. IDE overlays) can respond.
      when: () => {
        const ui = uiBus.get();
        return ui.paletteOpen || ui.devConsoleOpen || ui.rulesOpen || ui.settingsOpen || ui.dashboardOpen;
      },
      run: () => {
        const ui = uiBus.get();
        if (ui.paletteOpen) {
          uiBus.togglePalette(false);
          return;
        }
        if (ui.devConsoleOpen) {
          uiBus.toggleDevConsole(false);
          return;
        }
        if (ui.rulesOpen) {
          uiBus.toggleRules(false);
          return;
        }
        if (ui.settingsOpen) {
          uiBus.toggleSettings(false);
          return;
        }
        if (ui.dashboardOpen) {
          uiBus.toggleDashboard(false);
          return;
        }
      },
    }),
  );

  return () => {
    for (const d of disposers) d();
  };
}

export function useGlobalShortcuts() {
  useEffect(() => {
    const disposeShell = registerShellShortcuts();
    const onKey = (e: KeyboardEvent) => {
      shortcutRegistry.dispatch(e);
    };
    window.addEventListener("keydown", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      disposeShell();
    };
  }, []);
}
