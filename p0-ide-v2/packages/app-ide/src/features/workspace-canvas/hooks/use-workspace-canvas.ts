import { useEffect, useRef } from "react";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { buildSceneQuery, isClusterView } from "@quanta/canvas-engine";
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
  //    `buildSceneQuery` is LOD-aware: it returns a cluster view at
  //    supergalaxy and a file view elsewhere. Dedupe by id-sets so panning
  //    inside a stable visible region doesn't emit a fresh scene.
  const viewport = useStore(s => s.viewport);
  const layout   = useStore(s => s.layout);
  const lod      = useStore(s => s.lod);

  const lastIdsRef = useRef<{
    kind: "files" | "clusters";
    fileIds: Set<string>;
    edgeIds: Set<string>;
    clusterIds: Set<string>;
  } | null>(null);

  // Reset dedupe cache on graph/layout swap so the new scene always emits.
  useEffect(() => { lastIdsRef.current = null; }, [graph, layout]);

  useEffect(() => {
    if (!layout) return;
    const scene = buildSceneQuery(graph, layout, viewport, lod);
    if (isClusterView(scene)) {
      const clusterIds = new Set(scene.clusters.map(c => c.id));
      const prev = lastIdsRef.current;
      if (prev && prev.kind === "clusters" && setEq(prev.clusterIds, clusterIds)) return;
      lastIdsRef.current = { kind: "clusters", fileIds: new Set(), edgeIds: new Set(), clusterIds };
      workspaceCanvasStore.setClusterScene(scene);
    } else {
      const fileIds = new Set(scene.files.map(f => f.id));
      const edgeIds = new Set(scene.edges.map(e => e.id));
      const prev = lastIdsRef.current;
      if (prev && prev.kind === "files" && setEq(prev.fileIds, fileIds) && setEq(prev.edgeIds, edgeIds)) return;
      lastIdsRef.current = { kind: "files", fileIds, edgeIds, clusterIds: new Set() };
      workspaceCanvasStore.setVisibleScene(scene);
    }
  }, [graph, layout, viewport, lod]);
}
