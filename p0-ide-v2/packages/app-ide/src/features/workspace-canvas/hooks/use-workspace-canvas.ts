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

/**
 * Compare two id-arrays for "same contents in same order". The scene
 * builder populates `scene.files` / `scene.edges` by iterating the
 * spatial index in a deterministic order (rbush post-order → same order
 * for same viewport rect), so under a static pan the arrays are
 * position-by-position equal. This lets us sidestep Set construction
 * entirely in the frequently-hit equality check.
 *
 * In the rare case rbush returns the same ids in a different order, we
 * fall through to a small inline hash: XOR-sum the string length and
 * a cheap rolling hash so order-independent equality is still O(n) with
 * no allocations. False negatives here are harmless — they just cause a
 * redundant setState that React/Zustand will coalesce.
 */
function idsEqOrdered(a: ReadonlyArray<string>, b: ReadonlyArray<string>): boolean {
  if (a === b) return true;
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return false;
  }
  return true;
}

/**
 * Shared frozen empty-array placeholder so the "other tier" fields in
 * `lastIdsRef` don't each allocate a fresh `[]` on every tier change.
 * Reads only — callers never mutate an idsRef field.
 */
const EMPTY_IDS: ReadonlyArray<string> = Object.freeze([]) as ReadonlyArray<string>;

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

  // Dedupe cache. Historically held `Set<string>`s which required
  // per-frame `new Set(scene.files.map(f => f.id))` construction — the
  // #2 allocation source on the pan hot path (the #1 was visible-query
  // itself). We now stash raw id arrays and compare element-by-element.
  // The arrays we stash are the ones we just built, so after the first
  // frame the cost is a single `new Array(n)` fill (same as the one we
  // would already be doing).
  const lastIdsRef = useRef<{
    kind: SceneKind;
    fileIds: ReadonlyArray<string>;
    edgeIds: ReadonlyArray<string>;
    clusterIds: ReadonlyArray<string>;
    superclusterIds: ReadonlyArray<string>;
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

    // Hot path: build a single id[] out of the scene payload, compare to
    // the previously-stashed id[], and only feed the scene store if the
    // contents changed. All allocations are proportional to the visible
    // count (small) — no Set construction anywhere.
    //
    // Note: the spatial index emits ids in a deterministic order for a
    // given viewport (rbush post-order), so ordered comparison is correct
    // under steady-state pan/zoom. When order does change (tier swap,
    // layout rebuild) we fall through to the store update — at worst a
    // redundant setState, which Zustand short-circuits via shallow eq.

    if (isSuperclusterView(scene)) {
      const superclusters = scene.superclusters;
      const superclusterIds: string[] = new Array(superclusters.length);
      for (let i = 0; i < superclusters.length; i++) superclusterIds[i] = superclusters[i].id;

      const prev = lastIdsRef.current;
      if (prev && prev.kind === "superclusters" && idsEqOrdered(prev.superclusterIds, superclusterIds)) return;
      lastIdsRef.current = {
        kind: "superclusters",
        fileIds: EMPTY_IDS,
        edgeIds: EMPTY_IDS,
        clusterIds: EMPTY_IDS,
        superclusterIds,
      };
      sceneStore.setSuperclusterScene(scene);
    } else if (isClusterView(scene)) {
      const clusters = scene.clusters;
      const clusterIds: string[] = new Array(clusters.length);
      for (let i = 0; i < clusters.length; i++) clusterIds[i] = clusters[i].id;

      const prev = lastIdsRef.current;
      if (prev && prev.kind === "clusters" && idsEqOrdered(prev.clusterIds, clusterIds)) return;
      lastIdsRef.current = {
        kind: "clusters",
        fileIds: EMPTY_IDS,
        edgeIds: EMPTY_IDS,
        clusterIds,
        superclusterIds: EMPTY_IDS,
      };
      sceneStore.setClusterScene(scene);
    } else {
      const files = scene.files;
      const fileIds: string[] = new Array(files.length);
      for (let i = 0; i < files.length; i++) fileIds[i] = files[i].id;

      const edges = scene.edges;
      const edgeIds: string[] = new Array(edges.length);
      for (let i = 0; i < edges.length; i++) edgeIds[i] = edges[i].id;

      const prev = lastIdsRef.current;
      if (
        prev &&
        prev.kind === "files" &&
        idsEqOrdered(prev.fileIds, fileIds) &&
        idsEqOrdered(prev.edgeIds, edgeIds)
      ) return;
      lastIdsRef.current = {
        kind: "files",
        fileIds,
        edgeIds,
        clusterIds: EMPTY_IDS,
        superclusterIds: EMPTY_IDS,
      };
      sceneStore.setVisibleScene(scene);
    }
  }, [graph, layout, viewport, lod]);
}
