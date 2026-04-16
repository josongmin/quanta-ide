import { useState } from "react";
import { Sidebar } from "@quanta/app-ide/widgets/sidebar";
import { Editor } from "@quanta/app-ide/widgets/editor";
import { Inspector, type InspectorSelection } from "@quanta/app-ide/widgets/inspector";
import { BottomPanel } from "@quanta/app-ide/widgets/bottom-panel";
import { ResizeHandle } from "@quanta/ui-kit/ui/resize-handle";

interface IdePageProps {
  onResizeSidebar: (dx: number) => void;
  onResizeInspector: (dx: number) => void;
  onResizeBottom: (dy: number) => void;
}

export function IdePage({ onResizeSidebar, onResizeInspector, onResizeBottom }: IdePageProps) {
  const [selection, setSelection] = useState<InspectorSelection>({ kind: "file", name: "orchestrator.py" });

  return (
    <div className="ide-page">
      <div className="app-left">
        <div className="app-top-row">
          <Sidebar onSelect={(kind, name) => setSelection({ kind, name })} />
          <ResizeHandle ariaLabel="Resize sidebar" onResize={onResizeSidebar} />
          <Editor />
        </div>
        <ResizeHandle
          ariaLabel="Resize bottom panel"
          orientation="horizontal"
          onResize={onResizeBottom}
        />
        <BottomPanel />
      </div>
      <ResizeHandle ariaLabel="Resize inspector" onResize={onResizeInspector} />
      <Inspector selection={selection} />
    </div>
  );
}
