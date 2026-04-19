import type { ComponentType } from "react";
import type { FeatureManifest } from "./feature-types";
import type { ShortcutBinding } from "./shortcut-types";
import type { TabApp } from "./types";
export interface ShellAPI {
    openTab(app: TabApp, label: string): void;
    closeTab(tabId: string): void;
    selectTab(tabId: string): void;
    toast: {
        success(msg: string): void;
        error(msg: string): void;
        info(msg: string): void;
    };
    togglePalette(): void;
    toggleDevConsole(): void;
    toggleSettings(): void;
    toggleRules(open?: boolean): void;
    theme: {
        current: "light" | "dark";
        toggle(): void;
    };
    /** Register feature manifests. Returns a disposer that unregisters them. */
    registerFeatures(manifests: FeatureManifest[]): () => void;
    /** Register shortcut bindings. Returns a disposer that unregisters them. */
    registerShortcuts(bindings: ShortcutBinding[]): () => void;
    /** Register a global overlay component. Returns a disposer. */
    registerOverlay(id: string, component: ComponentType): () => void;
}
