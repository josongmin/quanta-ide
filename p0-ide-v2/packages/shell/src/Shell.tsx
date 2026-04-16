import { useState, type CSSProperties, type ReactNode } from "react";
import { LayoutProvider, type TabDescriptor } from "@quanta/shell-contract";
import { Topbar } from "@quanta/shell/widgets/topbar";
import { useGlobalShortcuts } from "@quanta/shell/features/global-shortcuts";
import { ToastHost } from "@quanta/ui-kit/ui/toast";
import { toastStore, useToasts } from "@quanta/shell/stores/toast-store";
import { useUiBus } from "@quanta/shell/stores/ui-bus";
import { CommandPaletteHost } from "@quanta/shell/widgets/command-palette";
import { DevConsoleHost } from "@quanta/shell/widgets/dev-console";
import { seedFeatures } from "@quanta/shell/feature-seed";
import { useOverlays } from "./overlay-registry";
import { appRegistry } from "./app-registry";
import { useTabManager } from "./tab-manager";
import { ShellProviderWrapper } from "./ShellProvider";

// ---------------------------------------------------------------------------
// Seed features on first import (idempotent).
// ---------------------------------------------------------------------------
seedFeatures();

// ---------------------------------------------------------------------------
// Initial tabs — Phase A hardcoded; will become persisted workspace state.
// ---------------------------------------------------------------------------
const initialTabs: TabDescriptor[] = [
  { id: "t1", app: "ide", label: "order-service" },
  { id: "t2", app: "ide", label: "payment-service" },
];

// ---------------------------------------------------------------------------
// Layout dimension constants
// ---------------------------------------------------------------------------
const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
const INSPECTOR_MIN = 260;
const INSPECTOR_MAX = 640;
const BOTTOM_MIN = 120;
const BOTTOM_MAX = 720;

const clamp = (v: number, min: number, max: number) =>
  Math.min(max, Math.max(min, v));


// ---------------------------------------------------------------------------
// Connected ToastHost — subscribes to toast-store, passes props to ui-kit.
// ---------------------------------------------------------------------------
function ConnectedToastHost() {
  const toasts = useToasts();
  return <ToastHost toasts={toasts} onDismiss={toastStore.dismiss} />;
}

// ---------------------------------------------------------------------------
// Shell — the root orchestrator component.
// ---------------------------------------------------------------------------
export function Shell() {
  useGlobalShortcuts();
  const registeredOverlays = useOverlays();
  const settingsOpen = useUiBus((s) => s.settingsOpen);
  const { state, openTab, addTab, closeTab, selectTab, toggleHome } =
    useTabManager(initialTabs);

  // Layout dimensions — IDE-specific but shell-level during Phase A
  const [sidebarW, setSidebarW] = useState(240);
  const [inspectorW, setInspectorW] = useState(360);
  const [bottomH, setBottomH] = useState(260);

  const layoutStyle = {
    "--sidebar-w": `${sidebarW}px`,
    "--inspector-w": `${inspectorW}px`,
    "--bottom-h": `${bottomH}px`,
  } as CSSProperties;

  const resizeCtx = {
    onResizeSidebar: (dx: number) =>
      setSidebarW((w) => clamp(w + dx, SIDEBAR_MIN, SIDEBAR_MAX)),
    onResizeInspector: (dx: number) =>
      setInspectorW((w) => clamp(w - dx, INSPECTOR_MIN, INSPECTOR_MAX)),
    onResizeBottom: (dy: number) =>
      setBottomH((h) => clamp(h - dy, BOTTOM_MIN, BOTTOM_MAX)),
  };

  const activeTab = state.tabs.find((t) => t.id === state.activeId);

  // Render the active tab's page via appRegistry.
  const renderActivePage = (): ReactNode => {
    if (!activeTab) return null;
    const descriptor = appRegistry.get(activeTab.app);
    if (!descriptor) return null;
    const Comp = descriptor.Component;
    return (
      <LayoutProvider value={resizeCtx}>
        <Comp tabId={activeTab.id} isActive />
      </LayoutProvider>
    );
  };

  // Resolve shell-level overrides (settings/home) from registry.
  const SettingsComp = appRegistry.get("settings")?.Component;
  const HomeComp = appRegistry.get("home")?.Component;

  return (
    <ShellProviderWrapper
      tabActions={{ openTab, closeTab, selectTab }}
    >
      <div className="app-shell" style={layoutStyle}>
        <Topbar
          tabs={state.tabs}
          activeId={state.activeId}
          onSelect={selectTab}
          onClose={closeTab}
          onAdd={addTab}
          homeOpen={state.homeOpen}
          onToggleHome={toggleHome}
        />
        <div className="app-main">
          {settingsOpen && SettingsComp ? (
            <SettingsComp tabId="__settings" isActive />
          ) : state.homeOpen && HomeComp ? (
            <HomeComp tabId="__home" isActive />
          ) : (
            renderActivePage()
          )}
        </div>

        {/* App-registered overlays (IDE overlays, etc.) */}
        {registeredOverlays.map((Overlay, i) => (
          <Overlay key={i} />
        ))}

        {/* Shell-owned overlays */}
        <CommandPaletteHost />
        <DevConsoleHost />
        <ConnectedToastHost />
      </div>
    </ShellProviderWrapper>
  );
}
