import { useState } from "react";
import { Sidebar } from "@/widgets/sidebar";
import { Editor } from "@/widgets/editor";
import { Inspector, type InspectorSelection } from "@/widgets/inspector";
import { BottomPanel } from "@/widgets/bottom-panel";
import { Statusbar } from "@/widgets/statusbar";
import { ResizeHandle } from "@/shared/ui/resize-handle";

interface IdePageProps {
  onResizeSidebar: (dx: number) => void;
  onResizeInspector: (dx: number) => void;
}

export function IdePage({ onResizeSidebar, onResizeInspector }: IdePageProps) {
  const [selection, setSelection] = useState<InspectorSelection>({ kind: "file", name: "orchestrator.py" });

  return (
    <div className="ide-page">
      <div className="app-left">
        <div className="app-top-row">
          <Sidebar onSelect={(kind, name) => setSelection({ kind, name })} />
          <ResizeHandle ariaLabel="Resize sidebar" onResize={onResizeSidebar} />
          <Editor />
        </div>
        <BottomPanel />
        <Statusbar />
      </div>
      <ResizeHandle ariaLabel="Resize inspector" onResize={onResizeInspector} />
      <Inspector selection={selection} />
    </div>
  );
}
