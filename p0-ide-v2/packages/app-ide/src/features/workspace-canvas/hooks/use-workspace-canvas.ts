import { useEffect } from "react";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { buildWorkspaceView } from "@quanta/canvas-engine";
import { workspaceCanvasStore, useWorkspaceCanvas as useStore } from "../store/workspace-canvas-store";
import { useLodSync } from "./use-lod-sync";
import { requestLayout, requestAggregates } from "./use-worker-bridge";

export function useWorkspaceCanvasOrchestrator(graph: WorkspaceGraph) {
  // 1. Push graph into store
  useEffect(() => {
    workspaceCanvasStore.setGraph(graph);
    // Trigger initial grid layout immediately (fast), then ELK (slow)
    requestLayout(graph, "grid-then-elk");
    requestAggregates(graph);
  }, [graph]);

  // 2. LOD sync
  useLodSync();

  // 3. Rebuild visible scene whenever viewport/layout/lod changes
  const viewport = useStore(s => s.viewport);
  const layout   = useStore(s => s.layout);
  const lod      = useStore(s => s.lod);

  useEffect(() => {
    if (!layout) return;
    const scene = buildWorkspaceView({ graph, layout, viewport, lod });
    workspaceCanvasStore.setVisibleScene(scene);
  }, [graph, layout, viewport, lod]);
}
