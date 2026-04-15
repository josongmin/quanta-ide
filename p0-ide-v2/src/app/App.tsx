import { useEffect, useState, type CSSProperties, type ReactNode } from "react";
import { Topbar, type Tab } from "@/widgets/topbar";
import { IdePage } from "@/pages/ide";
import { HomePage } from "@/pages/home";
import { NewTabPage } from "@/pages/new-tab";
import { AgentPage } from "@/pages/agent";
import { PrPage } from "@/pages/pr";
import { RulesModal } from "@/pages/rules";
import { ScenarioPage } from "@/pages/scenario";
import { ReviewsPage } from "@/pages/reviews";
import { SettingsPage } from "@/pages/settings";

type TabApp = Tab["app"];
import { useGlobalShortcuts } from "@/features/global-shortcuts";
import { SimulateOverlay } from "@/features/simulate-change";
import { ContextInjectOverlay } from "@/features/context-inject";
import { FirewallOverlay } from "@/features/firewall-inspector";
import { ToastHost } from "@/shared/ui/toast";
import { tabBus } from "@/shared/model/tab-bus";
import { useUiBus } from "@/shared/model/ui-bus";
import { CommandPaletteHost } from "@/widgets/command-palette";
import { DevConsoleHost } from "@/widgets/dev-console";
import { seedFeatures } from "./feature-seed";

seedFeatures();

const initialTabs: Tab[] = [
  { id: "t1", app: "ide", label: "order-service" },
  { id: "t2", app: "ide", label: "payment-service" },
];

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
const INSPECTOR_MIN = 260;
const INSPECTOR_MAX = 640;
const BOTTOM_MIN = 120;
const BOTTOM_MAX = 720;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function App() {
  useGlobalShortcuts();
  const settingsOpen = useUiBus((s) => s.settingsOpen);
  const [tabs, setTabs] = useState<Tab[]>(initialTabs);
  const [activeId, setActiveId] = useState<string>("t1");
  const [homeOpen, setHomeOpen] = useState(false);
  const [sidebarW, setSidebarW] = useState(240);
  const [inspectorW, setInspectorW] = useState(360);
  const [bottomH, setBottomH] = useState(260);

  const selectTab = (id: string) => {
    setHomeOpen(false);
    setActiveId(id);
  };

  const addTab = () => {
    setHomeOpen(false);
    const id = `t${Date.now()}`;
    setTabs((prev) => [...prev, { id, app: "new-tab", label: "New Tab" }]);
    setActiveId(id);
  };

  const toggleHome = () => {
    setHomeOpen((o) => !o);
  };

  // Listen for tab-bus open requests (from feature-registry commands etc.)
  useEffect(() => {
    return tabBus.subscribe(() => {
      const req = tabBus.consume();
      if (!req) return;
      const id = `t${Date.now()}-${req.id}`;
      setTabs((prev) => [...prev, { id, app: req.app, label: req.label }]);
      setActiveId(id);
    });
  }, []);

  const closeTab = (id: string) => {
    let next: Tab[] = [];
    setTabs((prev) => {
      next = prev.filter((t) => t.id !== id);
      return next;
    });
    setActiveId((cur) => (id === cur && next.length > 0 ? next[next.length - 1].id : cur));
  };

  const activeTab = tabs.find((t) => t.id === activeId);

  const layoutStyle = {
    "--sidebar-w": `${sidebarW}px`,
    "--inspector-w": `${inspectorW}px`,
    "--bottom-h": `${bottomH}px`,
  } as CSSProperties;

  const pageRegistry: Record<TabApp, () => ReactNode> = {
    home: () => <HomePage />, // not a tab; rendered via homeOpen overlay
    "new-tab": () => <NewTabPage />,
    agent: () => <AgentPage />,
    pr: () => <PrPage />,
    scenario: () => <ScenarioPage />,
    reviews: () => <ReviewsPage />,
    settings: () => <SettingsPage />,
    ide: () => (
      <IdePage
        onResizeSidebar={(dx) => setSidebarW((w) => clamp(w + dx, SIDEBAR_MIN, SIDEBAR_MAX))}
        onResizeInspector={(dx) => setInspectorW((w) => clamp(w - dx, INSPECTOR_MIN, INSPECTOR_MAX))}
        onResizeBottom={(dy) => setBottomH((h) => clamp(h - dy, BOTTOM_MIN, BOTTOM_MAX))}
      />
    ),
  };

  return (
    <div className="app-shell" style={layoutStyle}>
      <Topbar
        tabs={tabs}
        activeId={activeId}
        onSelect={selectTab}
        onClose={closeTab}
        onAdd={addTab}
        homeOpen={homeOpen}
        onToggleHome={toggleHome}
      />
      <div className="app-main">
        {settingsOpen ? <SettingsPage /> : homeOpen ? <HomePage /> : activeTab && pageRegistry[activeTab.app]()}
      </div>
      <SimulateOverlay />
      <ContextInjectOverlay />
      <FirewallOverlay />
      <RulesModal />
      <CommandPaletteHost />
      <DevConsoleHost />
      <ToastHost />
    </div>
  );
}
