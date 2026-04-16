import { type ComponentType, useState, useCallback } from "react";
import "./inspector.css";
import "./views/inspector-chrome.css";
import { IconClock, IconPlay } from "@quanta/ui-kit/ui/icons";
import { ResizeHandle } from "@quanta/ui-kit/ui/resize-handle";
import { AgentPane } from "@quanta/app-ide/features/inspector-agent";
import { PopoutPortal } from "@quanta/app-ide/features/inspector-agent/ui/PopoutPortal";
import { FileInspectorView } from "./views/FileInspectorView";
import { FolderInspectorView } from "./views/FolderInspectorView";
import { RepoInspectorView } from "./views/RepoInspectorView";

export type SelectionKind = "file" | "folder" | "repo";
export interface InspectorSelection {
  kind: SelectionKind;
  name: string;
}

interface InspectorProps {
  selection: InspectorSelection;
}

const VIEW_REGISTRY: Record<SelectionKind, ComponentType<{ name: string }>> = {
  file: FileInspectorView,
  folder: FolderInspectorView,
  repo: RepoInspectorView,
};

const AGENT_MIN = 120;
const AGENT_MAX = 720;
const AGENT_DEFAULT = 320;

export function Inspector({ selection }: InspectorProps) {
  const View = VIEW_REGISTRY[selection.kind];
  const [agentH, setAgentH] = useState(AGENT_DEFAULT);
  const [poppedOut, setPoppedOut] = useState(false);

  const handleResizeAgent = useCallback((dy: number) => {
    setAgentH((h) => Math.max(AGENT_MIN, Math.min(AGENT_MAX, h - dy)));
  }, []);

  const agentPane = (
    <AgentPane
      fileName={selection.name}
      onPopout={() => setPoppedOut(true)}
      poppedOut={poppedOut}
    />
  );

  return (
    <aside className="inspector" aria-label="Inspector">
      <div className={poppedOut ? "insp__analysis insp__analysis--full" : "insp__analysis"}>
        <View name={selection.name} />
      </div>

      {!poppedOut && (
        <>
          <ResizeHandle
            ariaLabel="Resize agent panel"
            orientation="horizontal"
            onResize={handleResizeAgent}
          />
          <div className="insp__agent-area" style={{ height: agentH, flex: "none" }}>
            {agentPane}
          </div>
        </>
      )}

      {poppedOut && (
        <PopoutPortal title="Agent" onClose={() => setPoppedOut(false)}>
          {agentPane}
        </PopoutPortal>
      )}

      <footer className="insp__foot">
        <span className="insp__foot-item"><IconPlay size={11} /> .status.engine</span>
        <span className="insp__foot-item insp__foot-mid"><IconClock size={11} /> session 46m 53s</span>
        <span className="insp__foot-item">
          <span className="insp__foot-dot" /> connected
        </span>
      </footer>
    </aside>
  );
}
