import { useEffect, useRef } from "react";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { buildWorkspaceView } from "@quanta/canvas-engine";
import { workspaceCanvasStore, useWorkspaceCanvas as useStore } from "../store/workspace-canvas-store";
import { useLodSync } from "./use-lod-sync";
import { requestLayout, requestAggregates } from "./use-worker-bridge";

function setEq(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

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

  // 3. Rebuild visible scene whenever viewport/layout/lod changes.
  //    Dedupe by id-sets: when the user pans inside a region that contains
  //    the same files, the spatial query returns a fresh array with
  //    identical contents. Skipping the setVisibleScene emit in that case
  //    avoids re-renders, Pixi effect re-runs, and edge cache rebuilds —
  //    the single biggest cost at 5000+ files.
  const viewport = useStore(s => s.viewport);
  const layout   = useStore(s => s.layout);
  const lod      = useStore(s => s.lod);

  const lastIdsRef = useRef<{ fileIds: Set<string>; edgeIds: Set<string> } | null>(null);

  // Reset dedupe cache on graph swap so the new scene is always emitted.
  useEffect(() => { lastIdsRef.current = null; }, [graph, layout]);

  useEffect(() => {
    if (!layout) return;
    const scene = buildWorkspaceView({ graph, layout, viewport, lod });
    const fileIds = new Set(scene.files.map(f => f.id));
    const edgeIds = new Set(scene.edges.map(e => e.id));
    const prev = lastIdsRef.current;
    if (prev && setEq(prev.fileIds, fileIds) && setEq(prev.edgeIds, edgeIds)) {
      return; // visible set unchanged — no emit needed
    }
    lastIdsRef.current = { fileIds, edgeIds };
    workspaceCanvasStore.setVisibleScene(scene);
  }, [graph, layout, viewport, lod]);
}
