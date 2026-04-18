import { useEffect, useRef } from "react";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { buildSceneQuery, isClusterView, isSuperclusterView } from "@quanta/canvas-engine";
import { batch } from "../store/workspace-canvas-store";
import { useViewportStore } from "../store/viewport-store";
import { sceneStore, useSceneStore } from "../store/scene-store";
import { interactionStore, useInteractionStore } from "../store/interaction-store";
import { useDebugSettings } from "../store/debug-settings-store";
import { useLodSync } from "./use-lod-sync";
import { requestLayout, requestAggregates } from "./use-worker-bridge";
import { getActiveGraphSource } from "../data/loaders";

type SceneKind = "files" | "clusters" | "superclusters";

function setEq(a: Set<string>, b: Set<string>): boolean {
  if (a.size !== b.size) return false;
  for (const x of a) if (!b.has(x)) return false;
  return true;
}

export function useWorkspaceCanvasOrchestrator(graph: WorkspaceGraph) {
  useEffect(() => {
    batch(() => {
      sceneStore.setGraph(graph);
      interactionStore.resetSelection();
    });
    interactionStore.setPathGraph({ fileEdges: graph.fileEdges });
    requestLayout(graph, "grid-then-elk");
    requestAggregates(graph);
  }, [graph]);

  // 2. LOD sync — graphKey resets the LOD manager's hysteretic tier when
  // the user swaps repos so a different graph's zoom state doesn't leak.
  const graphKey = getActiveGraphSource()?.graphKey ?? "default";
  useLodSync(graphKey);

  // 3. Rebuild visible scene whenever viewport/layout/lod changes. Each
  //    dependency subscribes to its owning sub-store so unrelated state
  //    mutations (hover, selection, settings toggles) don't re-run this.
  const viewport = useViewportStore(s => s.viewport);
  const layout   = useSceneStore(s => s.layout);
  const lod      = useInteractionStore(s => s.lod);
  const forceLod = useDebugSettings(s => s.forceLod);

  const lastIdsRef = useRef<{
    kind: SceneKind;
    fileIds: Set<string>;
    edgeIds: Set<string>;
    clusterIds: Set<string>;
    superclusterIds: Set<string>;
  } | null>(null);

  // Reset dedupe cache on graph/layout/forceLod swap so the new scene
  // always emits. forceLod is included because a manual LOD override
  // changes the downstream buildSceneQuery kind (cluster vs. files) —
  // if we skipped this, toggling forceLod while panning inside a stable
  // visible region would leave the old scene kind up until the id-set
  // changes.
  useEffect(() => { lastIdsRef.current = null; }, [graph, layout, forceLod]);

  useEffect(() => {
    if (!layout) return;
    const scene = buildSceneQuery(graph, layout, viewport, lod);
    if (isSuperclusterView(scene)) {
      const superclusterIds = new Set(scene.superclusters.map(c => c.id));
      const prev = lastIdsRef.current;
      if (prev && prev.kind === "superclusters" && setEq(prev.superclusterIds, superclusterIds)) return;
      lastIdsRef.current = {
        kind: "superclusters",
        fileIds: new Set(),
        edgeIds: new Set(),
        clusterIds: new Set(),
        superclusterIds,
      };
      sceneStore.setSuperclusterScene(scene);
    } else if (isClusterView(scene)) {
      const clusterIds = new Set(scene.clusters.map(c => c.id));
      const prev = lastIdsRef.current;
      if (prev && prev.kind === "clusters" && setEq(prev.clusterIds, clusterIds)) return;
      lastIdsRef.current = {
        kind: "clusters",
        fileIds: new Set(),
        edgeIds: new Set(),
        clusterIds,
        superclusterIds: new Set(),
      };
      sceneStore.setClusterScene(scene);
    } else {
      const fileIds = new Set(scene.files.map(f => f.id));
      const edgeIds = new Set(scene.edges.map(e => e.id));
      const prev = lastIdsRef.current;
      if (prev && prev.kind === "files" && setEq(prev.fileIds, fileIds) && setEq(prev.edgeIds, edgeIds)) return;
      lastIdsRef.current = {
        kind: "files",
        fileIds,
        edgeIds,
        clusterIds: new Set(),
        superclusterIds: new Set(),
      };
      sceneStore.setVisibleScene(scene);
    }
  }, [graph, layout, viewport, lod]);
}
