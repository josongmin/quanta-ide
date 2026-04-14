import { useState, type CSSProperties } from "react";
import { Topbar, type Tab } from "@/widgets/topbar/Topbar";
import { Sidebar } from "@/widgets/sidebar/Sidebar";
import { Editor } from "@/widgets/editor/Editor";
import { Inspector, type InspectorSelection } from "@/widgets/inspector/Inspector";
import { BottomPanel } from "@/widgets/bottom-panel/BottomPanel";
import { HomePicker } from "@/widgets/home-picker/HomePicker";
import { ResizeHandle } from "./ResizeHandle";
import { SimulateOverlay } from "./SimulateOverlay";
import { ContextInjectOverlay } from "./ContextInjectOverlay";
import { useGlobalShortcuts } from "./shortcuts";

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
const INSPECTOR_MIN = 260;
const INSPECTOR_MAX = 640;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

const initialTabs: Tab[] = [
  { id: "t1", app: "ide", label: "order-service" },
  { id: "t2", app: "ide", label: "payment-service" },
];

export function App() {
  useGlobalShortcuts();
  const [sidebarW, setSidebarW] = useState(240);
  const [inspectorW, setInspectorW] = useState(360);
  const [tabs, setTabs] = useState<Tab[]>(initialTabs);
  const [activeId, setActiveId] = useState<string>("t2");
  const [selection, setSelection] = useState<InspectorSelection>({ kind: "file", name: "orchestrator.py" });

  const addTab = () => {
    const id = `t${Date.now()}`;
    setTabs((prev) => [...prev, { id, app: "home", label: "새 탭" }]);
    setActiveId(id);
  };

  const closeTab = (id: string) => {
    setTabs((prev) => {
      const next = prev.filter((t) => t.id !== id);
      if (id === activeId && next.length > 0) setActiveId(next[next.length - 1].id);
      return next;
    });
  };

  const pickFromHome = (_choice: "repo" | "agent" | "pr", label: string) => {
    setTabs((prev) => prev.map((t) => (t.id === activeId ? { ...t, app: "ide", label } : t)));
  };

  const style = {
    "--sidebar-w": `${sidebarW}px`,
    "--inspector-w": `${inspectorW}px`,
  } as CSSProperties;

  const activeTab = tabs.find((t) => t.id === activeId);
  const isHome = activeTab?.app === "home";

  return (
    <div className="app-shell" style={style}>
      <Topbar
        tabs={tabs}
        activeId={activeId}
        onSelect={setActiveId}
        onClose={closeTab}
        onAdd={addTab}
      />
      <div className="app-main">
        {isHome ? (
          <HomePicker onPick={pickFromHome} />
        ) : (
          <>
            <div className="app-left">
              <div className="app-top-row">
                <Sidebar onSelect={(kind, name) => setSelection({ kind, name })} />
                <ResizeHandle
                  ariaLabel="Resize sidebar"
                  onResize={(dx) => setSidebarW((w) => clamp(w + dx, SIDEBAR_MIN, SIDEBAR_MAX))}
                />
                <Editor />
              </div>
              <BottomPanel />
            </div>
            <ResizeHandle
              ariaLabel="Resize inspector"
              onResize={(dx) => setInspectorW((w) => clamp(w - dx, INSPECTOR_MIN, INSPECTOR_MAX))}
            />
            <Inspector selection={selection} />
          </>
        )}
      </div>
      <SimulateOverlay />
      <ContextInjectOverlay />
    </div>
  );
}
