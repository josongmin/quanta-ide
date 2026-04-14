import { useState, type CSSProperties } from "react";
import { Topbar } from "@/widgets/topbar/Topbar";
import { Sidebar } from "@/widgets/sidebar/Sidebar";
import { Editor } from "@/widgets/editor/Editor";
import { Inspector } from "@/widgets/inspector/Inspector";
import { BottomPanel } from "@/widgets/bottom-panel/BottomPanel";
import { ResizeHandle } from "./ResizeHandle";

const SIDEBAR_MIN = 180;
const SIDEBAR_MAX = 480;
const INSPECTOR_MIN = 260;
const INSPECTOR_MAX = 640;

const clamp = (v: number, min: number, max: number) => Math.min(max, Math.max(min, v));

export function App() {
  const [sidebarW, setSidebarW] = useState(240);
  const [inspectorW, setInspectorW] = useState(360);

  const style = {
    "--sidebar-w": `${sidebarW}px`,
    "--inspector-w": `${inspectorW}px`,
  } as CSSProperties;

  return (
    <div className="app-shell" style={style}>
      <Topbar />
      <div className="app-main">
        <div className="app-left">
          <div className="app-top-row">
            <Sidebar />
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
        <Inspector />
      </div>
    </div>
  );
}
