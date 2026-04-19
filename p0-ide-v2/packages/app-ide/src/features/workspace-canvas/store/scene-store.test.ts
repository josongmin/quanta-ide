import { describe, it, expect, vi } from "vitest";
import { sceneStore } from "./scene-store";
import type {
  WorkspaceLayout,
  WorkspaceView,
  WorkspaceClusterView,
  WorkspaceSuperclusterView,
  Rect,
} from "@quanta/canvas-engine";

function makeLayout(): WorkspaceLayout {
  const bounds: Rect = { x: 0, y: 0, width: 100, height: 100 };
  return {
    fileRects: new Map(),
    edgeRoutes: new Map(),
    aggregates: {
      commentsByFunction: new Map(),
      commentsByFile: new Map(),
      commentedLines: new Map(),
    },
    totalBounds: bounds,
  };
}

function makeFileView(): WorkspaceView {
  return { files: [], edges: [], comments: [], kind: "files" };
}

function makeClusterView(): WorkspaceClusterView {
  return { clusters: [], kind: "supergalaxy" };
}

function makeSuperclusterView(): WorkspaceSuperclusterView {
  return { superclusters: [], kind: "universe" };
}

describe("scene-store", () => {
  it("setLayout short-circuits on same reference", () => {
    const layout = makeLayout();
    sceneStore.setLayout(layout);
    const listener = vi.fn();
    const unsubscribe = sceneStore.subscribe(listener);
    sceneStore.setLayout(layout);
    expect(listener).not.toHaveBeenCalled();
    // A different reference (even with equal contents) does emit.
    sceneStore.setLayout(makeLayout());
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("setVisibleScene clears clusterScene and superclusterScene", () => {
    sceneStore.setClusterScene(makeClusterView());
    sceneStore.setSuperclusterScene(makeSuperclusterView());
    const view = makeFileView();
    sceneStore.setVisibleScene(view);
    const s = sceneStore.getState();
    expect(s.visibleScene).toBe(view);
    expect(s.clusterScene).toBe(null);
    expect(s.superclusterScene).toBe(null);
  });

  it("setClusterScene clears visibleScene and superclusterScene", () => {
    sceneStore.setVisibleScene(makeFileView());
    sceneStore.setSuperclusterScene(makeSuperclusterView());
    const cluster = makeClusterView();
    sceneStore.setClusterScene(cluster);
    const s = sceneStore.getState();
    expect(s.clusterScene).toBe(cluster);
    expect(s.visibleScene).toBe(null);
    expect(s.superclusterScene).toBe(null);
  });

  it("setSuperclusterScene clears visibleScene and clusterScene", () => {
    sceneStore.setVisibleScene(makeFileView());
    sceneStore.setClusterScene(makeClusterView());
    const sc = makeSuperclusterView();
    sceneStore.setSuperclusterScene(sc);
    const s = sceneStore.getState();
    expect(s.superclusterScene).toBe(sc);
    expect(s.visibleScene).toBe(null);
    expect(s.clusterScene).toBe(null);
  });

  it("setWorkerState short-circuits when value unchanged", () => {
    sceneStore.setWorkerState("workerLayout", true);
    const listener = vi.fn();
    const unsubscribe = sceneStore.subscribe(listener);
    sceneStore.setWorkerState("workerLayout", true);
    expect(listener).not.toHaveBeenCalled();
    sceneStore.setWorkerState("workerLayout", false);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("setGroundDataBatch with empty input is a no-op", () => {
    const listener = vi.fn();
    const unsubscribe = sceneStore.subscribe(listener);
    sceneStore.setGroundDataBatch([]);
    sceneStore.setGroundDataBatch([], []);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });
});
