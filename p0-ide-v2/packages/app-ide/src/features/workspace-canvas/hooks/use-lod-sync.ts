import { useEffect } from "react";
import { LodManager } from "@quanta/canvas-engine";
import { useWorkspaceCanvas, workspaceCanvasStore } from "../store/workspace-canvas-store";

const manager = new LodManager();

export function useLodSync() {
  const scale    = useWorkspaceCanvas(s => s.viewport.scale);
  const forceLod = useWorkspaceCanvas(s => s.forceLod);

  useEffect(() => {
    // Debug: force-LOD overrides the automatic LOD manager so we can inspect
    // renderer behaviour at a specific tier regardless of zoom.
    const next = forceLod === "auto" ? manager.update(scale) : forceLod;
    const current = workspaceCanvasStore.getState().lod;
    if (next !== current) workspaceCanvasStore.setLod(next);
  }, [scale, forceLod]);
}
