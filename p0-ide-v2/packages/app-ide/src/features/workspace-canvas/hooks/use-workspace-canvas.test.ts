import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import type { FileNode, WorkspaceGraph } from "@quanta/canvas-engine";
import { useWorkspaceCanvasOrchestrator } from "./use-workspace-canvas";
import { sceneStore } from "../store/scene-store";
import { interactionStore } from "../store/interaction-store";

// Worker bridge: mock the two request functions we want to observe. This
// avoids spawning a real Worker (jsdom would fail on the new Worker(URL)).
vi.mock("./use-worker-bridge", () => ({
  requestLayout: vi.fn(),
  requestAggregates: vi.fn(),
  requestEdgeGeometry: vi.fn(),
  useWorkerBridge: () => ({
    requestLayout: vi.fn(),
    requestAggregates: vi.fn(),
    requestEdgeGeometry: vi.fn(),
  }),
}));

// `use-lod-sync` pulls viewport + settings and is not under test here.
vi.mock("./use-lod-sync", () => ({
  useLodSync: () => { /* no-op */ },
}));

const { requestLayout, requestAggregates } = await import("./use-worker-bridge");
const reqLayoutMock = requestLayout as unknown as ReturnType<typeof vi.fn>;
const reqAggMock = requestAggregates as unknown as ReturnType<typeof vi.fn>;

function file(id: string): FileNode {
  return {
    id,
    name: id,
    layer: "domain",
    riskScore: 0,
    loc: 10,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
  };
}

describe("useWorkspaceCanvasOrchestrator", () => {
  beforeEach(() => {
    reqLayoutMock.mockReset();
    reqAggMock.mockReset();
    // Reset scene + selection so stale state from a previous test doesn't
    // leak into the effect closure.
    sceneStore.setGraph({ files: [], fileEdges: [], comments: [] });
    interactionStore.resetSelection();
  });

  afterEach(() => {
    interactionStore.resetSelection();
  });

  it("on initial mount: pushes graph into scene store and fires layout + aggregates", () => {
    const g: WorkspaceGraph = { files: [file("a"), file("b")], fileEdges: [], comments: [] };
    renderHook(() => useWorkspaceCanvasOrchestrator(g));

    expect(reqLayoutMock).toHaveBeenCalledTimes(1);
    expect(reqLayoutMock.mock.calls[0][0]).toBe(g);
    expect(reqLayoutMock.mock.calls[0][1]).toBe("grid-then-elk");
    expect(reqAggMock).toHaveBeenCalledTimes(1);
    expect(reqAggMock.mock.calls[0][0]).toBe(g);
    expect(sceneStore.getState().graph).toBe(g);
  });

  it("same graph reference across re-renders does NOT re-trigger layout", () => {
    const g: WorkspaceGraph = { files: [file("a")], fileEdges: [], comments: [] };
    const { rerender } = renderHook(({ graph }) => useWorkspaceCanvasOrchestrator(graph), {
      initialProps: { graph: g },
    });
    expect(reqLayoutMock).toHaveBeenCalledTimes(1);

    // Re-render with the exact same reference — React's dep compare should
    // skip the effect.
    rerender({ graph: g });
    expect(reqLayoutMock).toHaveBeenCalledTimes(1);
    expect(reqAggMock).toHaveBeenCalledTimes(1);
  });

  it("new graph reference triggers a fresh layout + aggregates run", () => {
    const g1: WorkspaceGraph = { files: [file("a")], fileEdges: [], comments: [] };
    const g2: WorkspaceGraph = { files: [file("b")], fileEdges: [], comments: [] };

    const { rerender } = renderHook(({ graph }) => useWorkspaceCanvasOrchestrator(graph), {
      initialProps: { graph: g1 },
    });
    expect(reqLayoutMock).toHaveBeenCalledTimes(1);

    rerender({ graph: g2 });
    expect(reqLayoutMock).toHaveBeenCalledTimes(2);
    expect(reqLayoutMock.mock.calls[1][0]).toBe(g2);
    expect(reqAggMock).toHaveBeenCalledTimes(2);
    // The scene store's graph should now point to the new reference.
    expect(sceneStore.getState().graph).toBe(g2);
  });

  it("graph swap clears previous selection via resetSelection()", () => {
    const g1: WorkspaceGraph = { files: [file("a")], fileEdges: [], comments: [] };
    const { rerender } = renderHook(({ graph }) => useWorkspaceCanvasOrchestrator(graph), {
      initialProps: { graph: g1 },
    });

    act(() => { interactionStore.selectFile("a"); });
    expect(interactionStore.getState().viewState.selectedFileId).toBe("a");

    const g2: WorkspaceGraph = { files: [file("c")], fileEdges: [], comments: [] };
    rerender({ graph: g2 });

    expect(interactionStore.getState().viewState.selectedFileId).toBeNull();
  });
});
