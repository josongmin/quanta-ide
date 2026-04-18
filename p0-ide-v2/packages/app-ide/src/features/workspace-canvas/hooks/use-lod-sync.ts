import { useEffect } from "react";
import { LodManager } from "@quanta/canvas-engine";
import { useWorkspaceCanvas, workspaceCanvasStore } from "../store/workspace-canvas-store";

const manager = new LodManager();

export function useLodSync() {
  const scale = useWorkspaceCanvas(s => s.viewport.scale);

  useEffect(() => {
    const next = manager.update(scale);
    const current = workspaceCanvasStore.getState().lod;
    if (next !== current) workspaceCanvasStore.setLod(next);
  }, [scale]);
}
