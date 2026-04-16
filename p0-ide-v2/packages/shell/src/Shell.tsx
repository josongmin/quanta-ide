import { useState, type CSSProperties, type ReactNode } from "react";
import type { TabDescriptor } from "@quanta/shell-contract";
import { Topbar } from "@/widgets/topbar";
import { IdePage } from "@/pages/ide";
import { HomePage } from "@/pages/home";
import { NewTabPage } from "@/pages/new-tab";
import { AgentPage } from "@/pages/agent";
import { PrPage } from "@/pages/pr";
import { RulesModal } from "@/pages/rules";
import { ScenarioPage } from "@/pages/scenario";
import { ReviewsPage } from "@/pages/reviews";
import { SettingsPage } from "@/pages/settings";
import { useGlobalShortcuts } from "@/features/global-shortcuts";
import { ToastHost } from "@/shared/ui/toast";
import { useUiBus } from "@/shared/model/ui-bus";
import { CommandPaletteHost } from "@/widgets/command-palette";
import { DevConsoleHost } from "@/widgets/dev-console";
import { seedFeatures } from "@/app/feature-seed";

// TODO: move to app-ide — these are IDE-specific overlays
import { SimulateOverlay } from "@/features/simulate-change";
import { ContextInjectOverlay } from "@/features/context-inject";
import { FirewallOverlay } from "@/features/firewall-inspector";

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
// Page registry — backward-compat bridge until apps register via appRegistry.
// The `ide` entry receives layout resize callbacks from Shell-level state.
// ---------------------------------------------------------------------------
type PageFactory = (ctx: {
  onResizeSidebar: (dx: number) => void;
  onResizeInspector: (dx: number) => void;
  onResizeBottom: (dy: number) => void;
}) => ReactNode;

const pageRegistry: Record<string, PageFactory> = {
  "new-tab": () => <NewTabPage />,
  agent: () => <AgentPage />,
  pr: () => <PrPage />,
  scenario: () => <ScenarioPage />,
  reviews: () => <ReviewsPage />,
  settings: () => <SettingsPage />,
  ide: (ctx) => (
    <IdePage
      onResizeSidebar={ctx.onResizeSidebar}
      onResizeInspector={ctx.onResizeInspector}
      onResizeBottom={ctx.onResizeBottom}
    />
  ),
};

// ---------------------------------------------------------------------------
// Shell — the root orchestrator component.
// ---------------------------------------------------------------------------
export function Shell() {
  useGlobalShortcuts();
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

  // Render the active tab's page via the backward-compat registry.
  // Once apps register with appRegistry, TabRenderer will replace this.
  const renderActivePage = (): ReactNode => {
    if (!activeTab) return null;
    const factory = pageRegistry[activeTab.app];
    if (!factory) return null;
    return factory(resizeCtx);
  };

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
          {settingsOpen ? (
            <SettingsPage />
          ) : state.homeOpen ? (
            <HomePage />
          ) : (
            renderActivePage()
          )}
        </div>

        {/* TODO: move to app-ide — IDE-specific overlays */}
        <SimulateOverlay />
        <ContextInjectOverlay />
        <FirewallOverlay />

        {/* Global overlays managed by shell */}
        <RulesModal />
        <CommandPaletteHost />
        <DevConsoleHost />
        <ToastHost />
      </div>
    </ShellProviderWrapper>
  );
}
