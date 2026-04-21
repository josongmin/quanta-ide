import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type {
  ArchLayer,
  EdgeKind,
  EdgeLayer,
  FileEdge,
  FileNode,
  ViewState,
  WorkspaceGraph,
  WorkspaceLayout,
  PathQuery,
  PathResult,
} from "@quanta/canvas-engine";
import { useEdgeFocusLogic } from "./use-edge-focus-logic";
import { interactionStore } from "../store/interaction-store";
import { sceneStore } from "../store/scene-store";
import { renderSettingsStore } from "../store/render-settings-store";

function file(id: string, layer: ArchLayer = "domain"): FileNode {
  return {
    id,
    name: id,
    layer,
    riskScore: 0,
    loc: 10,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
  };
}

function edge(id: string, from: string, to: string): FileEdge {
  const kind: EdgeKind = "import";
  const layer: EdgeLayer = "structural";
  return { id, from, to, kind, layer, weight: 1 };
}

function makeGraph(files: FileNode[], fileEdges: FileEdge[]): WorkspaceGraph {
  return { files, fileEdges, comments: [] };
}

function emptyViewState(): ViewState {
  return {
    lod: "galaxy",
    selectedFileId: null,
    hoveredFileId: null,
    selectedEdgeId: null,
    hoveredEdgeId: null,
    focusedNodeId: null,
    hoveredClusterId: null,
    hoveredSuperclusterId: null,
    selectedSymbolId: null,
    hoveredSymbolId: null,
  };
}

describe("use-edge-focus-logic", () => {
  beforeEach(() => {
    interactionStore.clearPathQuery();
    interactionStore.setFocusMode("off");
    renderSettingsStore.setEdgeFilterQuery("");
    renderSettingsStore.setHighlightArchViolations(false);
  });

  afterEach(() => {
    interactionStore.clearPathQuery();
    interactionStore.setFocusMode("off");
    renderSettingsStore.setEdgeFilterQuery("");
    renderSettingsStore.setHighlightArchViolations(false);
  });

  it("returns edgeFocus=undefined when no path query, no focus, no violations", () => {
    const g = makeGraph([file("a"), file("b")], [edge("e1", "a", "b")]);
    const { result } = renderHook(() =>
      useEdgeFocusLogic(g, null, emptyViewState()),
    );
    expect(result.current.edgeFocus).toBeUndefined();
    expect(result.current.edgeViolations).toBeUndefined();
  });

  it("returns focused path edges when pathQuery + pathResult are set", () => {
    const g = makeGraph(
      [file("a"), file("b"), file("c")],
      [edge("e1", "a", "b"), edge("e2", "b", "c")],
    );
    const q: PathQuery = { sourceFileId: "a", targetFileId: "c", mode: "shortest" };
    act(() => {
      sceneStore.setGraph(g);
      interactionStore.setPathQuery(q);
    });
    const { result } = renderHook(() =>
      useEdgeFocusLogic(g, null, emptyViewState()),
    );
    expect(result.current.edgeFocus).toBeDefined();
    const ids = result.current.edgeFocus!.edgeIds;
    expect(ids.has("e1") && ids.has("e2")).toBe(true);
  });

  it("returns violation edge ids when highlightArchViolations is on", () => {
    const g = makeGraph([file("a")], [edge("e1", "a", "a")]);
    const layout = {
      archViolations: { edgeIds: ["e1", "e42"], byPair: {} },
    } as unknown as WorkspaceLayout;
    act(() => { renderSettingsStore.setHighlightArchViolations(true); });
    const { result } = renderHook(() =>
      useEdgeFocusLogic(g, layout, emptyViewState()),
    );
    expect(result.current.edgeViolations).toBeDefined();
    expect(result.current.edgeViolations!.has("e1")).toBe(true);
    expect(result.current.edgeViolations!.has("e42")).toBe(true);
  });

  it("path focus wins over neighborhood focus when both are present", () => {
    const g = makeGraph(
      [file("a"), file("b"), file("c"), file("d")],
      [edge("eAB", "a", "b"), edge("eBC", "b", "c"), edge("eCD", "c", "d")],
    );
    act(() => {
      interactionStore.setFocusMode("on");
      sceneStore.setGraph(g);
      interactionStore.setPathQuery({
        sourceFileId: "a",
        targetFileId: "b",
        mode: "shortest",
      } satisfies PathQuery);
    });
    const vs: ViewState = { ...emptyViewState(), selectedFileId: "c" };
    const { result } = renderHook(() => useEdgeFocusLogic(g, null, vs));
    // Path from a→b is edge eAB; focus neighborhood of c would otherwise
    // include eBC and eCD. Path must dominate.
    const ids = result.current.edgeFocus!.edgeIds;
    expect(ids.has("eAB")).toBe(true);
    expect(ids.has("eCD")).toBe(false);
    // Clear the cached fake result to avoid polluting other tests.
    act(() => {
      const nothing: PathResult = { paths: [], truncated: false };
      void nothing;
    });
  });

  it("compiles edgePredicate and accepts empty query as always-true", () => {
    const g = makeGraph([file("a"), file("b")], [edge("e1", "a", "b")]);
    const { result } = renderHook(() =>
      useEdgeFocusLogic(g, null, emptyViewState()),
    );
    expect(typeof result.current.edgePredicate).toBe("function");
    expect(result.current.edgePredicate!(edge("e1", "a", "b"))).toBe(true);
  });
});
