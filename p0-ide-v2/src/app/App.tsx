import { useState, type CSSProperties, type ReactNode } from "react";
import { Topbar, type Tab } from "@/widgets/topbar";
import { IdePage } from "@/pages/ide";
import { HomePage } from "@/pages/home";
import { AgentPage } from "@/pages/agent";
import { PrPage } from "@/pages/pr";

type TabApp = Tab["app"];
import { useGlobalShortcuts } from "@/features/global-shortcuts";
import { SimulateOverlay } from "@/features/simulate-change";
import { ContextInjectOverlay } from "@/features/context-inject";

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
  const [tabs, setTabs] = useState<Tab[]>(initialTabs);
  const [activeId, setActiveId] = useState<string>("t2");
  const [sidebarW, setSidebarW] = useState(240);
  const [inspectorW, setInspectorW] = useState(360);
  const [bottomH, setBottomH] = useState(260);

  const addTab = () => {
    const id = `t${Date.now()}`;
    setTabs((prev) => [...prev, { id, app: "home", label: "New Tab" }]);
    setActiveId(id);
  };

  const closeTab = (id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (id === activeId && next.length > 0) setActiveId(next[next.length - 1].id);
      return next;
    });
  };

  const pickFromHome = (choice: "repo" | "agent" | "pr", label: string) => {
    const app: Tab["app"] = choice === "agent" ? "agent" : choice === "pr" ? "pr" : "ide";
    setTabs((prev) => prev.map((t) => (t.id === activeId ? { ...t, app, label } : t)));
  };

  const activeTab = tabs.find((t) => t.id === activeId);

  const layoutStyle = {
    "--sidebar-w": `${sidebarW}px`,
    "--inspector-w": `${inspectorW}px`,
    "--bottom-h": `${bottomH}px`,
  } as CSSProperties;

  const pageRegistry: Record<TabApp, () => ReactNode> = {
    home: () => <HomePage onPick={pickFromHome} />,
    agent: () => <AgentPage />,
    pr: () => <PrPage />,
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
        onSelect={setActiveId}
        onClose={closeTab}
        onAdd={addTab}
      />
      <div className="app-main">
        {activeTab && pageRegistry[activeTab.app]()}
      </div>
      <SimulateOverlay />
      <ContextInjectOverlay />
    </div>
  );
}
