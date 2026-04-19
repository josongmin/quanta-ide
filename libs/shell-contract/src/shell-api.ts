import type { ComponentType } from "react";
import type { FeatureManifest } from "./feature-types";
import type { ShortcutBinding } from "./shortcut-types";
import type { TabApp } from "./types";

// ---------------------------------------------------------------------------
// Shell API — the capability surface every tab app receives via context.
// ---------------------------------------------------------------------------

export interface ShellAPI {
  // -- Tab management -------------------------------------------------------
  openTab(app: TabApp, label: string): void;
  closeTab(tabId: string): void;
  selectTab(tabId: string): void;

  // -- Toast ----------------------------------------------------------------
  toast: {
    success(msg: string): void;
    error(msg: string): void;
    info(msg: string): void;
  };

  // -- UI toggles -----------------------------------------------------------
  togglePalette(): void;
  toggleDevConsole(): void;
  toggleSettings(): void;
  toggleRules(open?: boolean): void;

  // -- Theme ----------------------------------------------------------------
  theme: { current: "light" | "dark"; toggle(): void };

  // -- Feature / shortcut registration --------------------------------------
  /** Register feature manifests. Returns a disposer that unregisters them. */
  registerFeatures(manifests: FeatureManifest[]): () => void;
  /** Register shortcut bindings. Returns a disposer that unregisters them. */
  registerShortcuts(bindings: ShortcutBinding[]): () => void;

  // -- Overlay registration --------------------------------------------------
  /** Register a global overlay component. Returns a disposer. */
  registerOverlay(id: string, component: ComponentType): () => void;
}
