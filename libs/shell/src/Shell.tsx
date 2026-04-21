import { Suspense, useLayoutEffect, useMemo, useRef, useState, type CSSProperties, type ReactNode } from "react";
import { clamp } from "@quanta/canvas-engine";
import { LayoutProvider, TabRouteProvider, type TabDescriptor } from "@quanta/shell-contract";
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
  { id: "t1", app: "demo", label: "Try demo", slug: "demo" },
  { id: "t2", app: "ide", label: "order-service", slug: "order-service" },
  { id: "t3", app: "ide", label: "payment-service", slug: "payment-service" },
  { id: "t4", app: "workspace", label: "Code Universe", slug: "code-universe" },
  { id: "t5", app: "universe", label: "Code Universe v2", slug: "universe" },
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


// ---------------------------------------------------------------------------
// Connected ToastHost — subscribes to toast-store, passes props to ui-kit.
// ---------------------------------------------------------------------------
function ConnectedToastHost() {
  const toasts = useToasts();
  return <ToastHost toasts={toasts} onDismiss={toastStore.dismiss} />;
}

// ---------------------------------------------------------------------------
// AppSkeleton — lightweight placeholder shown while a lazy app chunk loads.
// ---------------------------------------------------------------------------
function AppSkeleton() {
  return <div className="app-skeleton" />;
}

// ---------------------------------------------------------------------------
// Shell — the root orchestrator component.
// ---------------------------------------------------------------------------
export function Shell() {
  useGlobalShortcuts();
  const registeredOverlays = useOverlays();
  const settingsOpen = useUiBus((s) => s.settingsOpen);
  const dashboardOpen = useUiBus((s) => s.dashboardOpen);
  const { state, openTab, addTab, closeTab, selectTab, toggleHome } =
    useTabManager(initialTabs);

  // Stable tabActions for ShellProvider — prevents ShellAPI recreation on every render.
  const tabActions = useMemo(
    () => ({ openTab, closeTab, selectTab }),
    [openTab, closeTab, selectTab],
  );

  // Layout dimensions — IDE-specific but shell-level during Phase A
  const [sidebarW, setSidebarW] = useState(240);
  const [inspectorW, setInspectorW] = useState(360);
  const [bottomH, setBottomH] = useState(260);

  const layoutStyle = {
    "--sidebar-w": `${sidebarW}px`,
    "--inspector-w": `${inspectorW}px`,
    "--bottom-h": `${bottomH}px`,
  } as CSSProperties;

  // Stable resize context — callbacks use refs to avoid re-creating on every render.
  const sidebarRef = useRef(setSidebarW);
  const inspectorRef = useRef(setInspectorW);
  const bottomRef = useRef(setBottomH);
  sidebarRef.current = setSidebarW;
  inspectorRef.current = setInspectorW;
  bottomRef.current = setBottomH;

  const resizeCtx = useMemo(() => ({
    onResizeSidebar: (dx: number) =>
      sidebarRef.current((w) => clamp(w + dx, SIDEBAR_MIN, SIDEBAR_MAX)),
    onResizeInspector: (dx: number) =>
      inspectorRef.current((w) => clamp(w - dx, INSPECTOR_MIN, INSPECTOR_MAX)),
    onResizeBottom: (dy: number) =>
      bottomRef.current((h) => clamp(h - dy, BOTTOM_MIN, BOTTOM_MAX)),
  }), []);

  // When an active topbar tab covers the sidebar edge, set a data attr so CSS
  // can hide the resize-handle top (ㅜ shape instead of + shape).
  const shellRef = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const shell = shellRef.current;
    if (!shell) return;
    const check = () => {
      const tab = shell.querySelector<HTMLElement>(".topbar__tab.is-active");
      if (!tab) {
        shell.removeAttribute("data-sidebar-under-tab");
        return;
      }
      const shellLeft = shell.getBoundingClientRect().left;
      const tabRect = tab.getBoundingClientRect();
      const edge = shellLeft + sidebarW;
      if (edge >= tabRect.left && edge <= tabRect.right) {
        shell.setAttribute("data-sidebar-under-tab", "");
      } else {
        shell.removeAttribute("data-sidebar-under-tab");
      }
    };
    check();
    window.addEventListener("resize", check);
    return () => window.removeEventListener("resize", check);
  }, [sidebarW, state.activeId, state.homeOpen, settingsOpen, dashboardOpen, state.tabs.length]);

  const activeTab = state.tabs.find((t) => t.id === state.activeId);

  // Render the active tab's page via appRegistry.
  const renderActivePage = (): ReactNode => {
    if (!activeTab) return null;
    const descriptor = appRegistry.get(activeTab.app);
    if (!descriptor) return null;
    const Comp = descriptor.Component;
    // Scope URL routing to the active tab — the provider remounts
    // on slug change so one tab's query/path can't leak into another's.
    const slug = activeTab.slug ?? activeTab.app;
    return (
      <LayoutProvider value={resizeCtx}>
        <TabRouteProvider key={slug} slug={slug}>
          <Suspense fallback={<AppSkeleton />}>
            <Comp tabId={activeTab.id} isActive />
          </Suspense>
        </TabRouteProvider>
      </LayoutProvider>
    );
  };

  // Resolve shell-level overrides (settings/home/dashboard) from registry.
  const SettingsComp = appRegistry.get("settings")?.Component;
  const HomeComp = appRegistry.get("home")?.Component;
  const DashboardComp = appRegistry.get("dashboard")?.Component;

  return (
    <ShellProviderWrapper
      tabActions={tabActions}
    >
      <div className="app-shell" ref={shellRef} style={layoutStyle}>
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
            <Suspense fallback={<AppSkeleton />}>
              <SettingsComp tabId="__settings" isActive />
            </Suspense>
          ) : dashboardOpen && DashboardComp ? (
            <Suspense fallback={<AppSkeleton />}>
              <DashboardComp tabId="__dashboard" isActive />
            </Suspense>
          ) : state.homeOpen && HomeComp ? (
            <Suspense fallback={<AppSkeleton />}>
              <HomeComp tabId="__home" isActive />
            </Suspense>
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
