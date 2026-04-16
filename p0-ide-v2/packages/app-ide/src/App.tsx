import { useEffect } from "react";
import type { TabAppProps } from "@quanta/shell-contract";
import { useShell } from "@quanta/shell-contract";
import { IdePage } from "@quanta/app-ide/pages/ide";
import { SimulateOverlay } from "@quanta/app-ide/features/simulate-change";
import { ContextInjectOverlay } from "@quanta/app-ide/features/context-inject";
import { FirewallOverlay } from "@quanta/app-ide/features/firewall-inspector";
import { focusStore } from "@quanta/app-ide/stores/focus-store";
import { useLayout } from "./layout-context";

/**
 * IDE tab application.
 *
 * Reads layout resize callbacks from LayoutContext (provided by Shell)
 * and forwards them to the existing IdePage component.
 *
 * Registers IDE-specific overlays and shortcuts with the shell on mount
 * so the shell never imports from app-ide directly.
 */
export function IdeApp(_props: TabAppProps) {
  const layout = useLayout();
  const shell = useShell();

  // Register overlays with the shell's overlay registry.
  useEffect(() => {
    const d1 = shell.registerOverlay("simulate", SimulateOverlay);
    const d2 = shell.registerOverlay("context-inject", ContextInjectOverlay);
    const d3 = shell.registerOverlay("firewall", FirewallOverlay);
    return () => { d1(); d2(); d3(); };
  }, [shell]);

  // Register IDE-specific shortcuts (overview mode + escape for IDE overlays).
  useEffect(() => {
    const dispose = shell.registerShortcuts([
      {
        id: "inspector.mode.overview",
        keys: "mod+1",
        label: "Overview inspector",
        run: (e) => {
          e.preventDefault();
          focusStore.setMode("overview");
        },
      },
      {
        id: "escape.ide",
        keys: "escape",
        label: "Close IDE overlays",
        ignoreMods: true,
        // Lower priority so shell-level escape (palette, settings, etc.) fires first.
        priority: -1,
        when: () => {
          const s = focusStore.get();
          return s.simulateOpen || s.contextInjectOpen || s.firewallOpen;
        },
        run: () => {
          const s = focusStore.get();
          if (s.simulateOpen) focusStore.toggleSimulate(false);
          if (s.contextInjectOpen) focusStore.toggleContextInject(false);
          if (s.firewallOpen) focusStore.toggleFirewall(false);
        },
      },
    ]);
    return dispose;
  }, [shell]);

  return (
    <IdePage
      onResizeSidebar={layout.onResizeSidebar}
      onResizeInspector={layout.onResizeInspector}
      onResizeBottom={layout.onResizeBottom}
    />
  );
}
