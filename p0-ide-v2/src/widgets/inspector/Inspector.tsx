import "./inspector.css";
import { IconClock, IconPlay } from "./icons";
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

export function Inspector({ selection }: InspectorProps) {
  return (
    <aside className="inspector" aria-label="Inspector">
      {selection.kind === "file" && <FileInspectorView name={selection.name} />}
      {selection.kind === "folder" && <FolderInspectorView name={selection.name} />}
      {selection.kind === "repo" && <RepoInspectorView name={selection.name} />}

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
