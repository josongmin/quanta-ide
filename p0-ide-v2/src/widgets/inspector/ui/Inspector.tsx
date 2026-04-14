import type { ComponentType } from "react";
import "./inspector.css";
import { IconClock, IconPlay } from "@/shared/ui/icons";
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

export function Inspector({ selection }: InspectorProps) {
  const View = VIEW_REGISTRY[selection.kind];
  return (
    <aside className="inspector" aria-label="Inspector">
      <View name={selection.name} />

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
