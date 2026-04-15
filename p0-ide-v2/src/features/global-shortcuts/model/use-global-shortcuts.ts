import { useEffect } from "react";
import { focusStore } from "@/shared/model/focus-store";
import { uiBus } from "@/shared/model/ui-bus";
import { tabBus } from "@/shared/model/tab-bus";
import { shortcutRegistry } from "@/shared/model/shortcut-registry";

/**
 * Register the "shell-level" shortcuts — palette, new tab, overview
 * mode, and the escape cascade — that aren't owned by any single
 * feature manifest. Feature-specific shortcuts (⌘⇧R, ⌘2-6, ⌘E,
 * ⌘⇧S, ⌘⇧F, ⌘⌥⇧D, …) are registered declaratively in feature-seed.
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
      id: "inspector.mode.overview",
      keys: "mod+1",
      label: "Overview inspector",
      run: (e) => {
        e.preventDefault();
        focusStore.setMode("overview");
      },
    }),
    shortcutRegistry.register({
      id: "escape.closeAll",
      keys: "escape",
      label: "Close overlays",
      ignoreMods: true,
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
        const s = focusStore.get();
        if (s.simulateOpen) focusStore.toggleSimulate(false);
        if (s.contextInjectOpen) focusStore.toggleContextInject(false);
        if (s.firewallOpen) focusStore.toggleFirewall(false);
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
