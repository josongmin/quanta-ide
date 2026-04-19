import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRef } from "react";
import type { EdgePickIndex } from "@quanta/canvas-engine";
import { useCanvasInteractions, type UseCanvasInteractionsOpts } from "./use-canvas-interactions";
import { viewportStore } from "../store/viewport-store";
import { interactionStore } from "../store/interaction-store";
import { sceneStore } from "../store/scene-store";

// Covers the subset of use-canvas-interactions that does NOT need a live
// DOM container: the returned `selectFile`, `hoverFile`, zoom helpers, and
// the mouse-down→mouse-move→click drag-guard path. Container-level wheel /
// dblclick / edge-pick mousemove listeners are wired inside useEffect with
// `containerRef.current`; those branches are covered by integration tests.

function makeRefs() {
  const container = document.createElement("div");
  const containerRef = { current: container };
  // Minimal EdgePickIndex stub — the drag/click guards never call pickAt
  // on the branches we exercise here (no ctrl/meta+click delivered).
  const edgePickIndex: EdgePickIndex = {
    pickAt: () => null,
    // The real type declares a `size` + `rebuild`; we cast to bypass the
    // structural check for the unused parts.
  } as unknown as EdgePickIndex;
  const edgePickIndexRef = { current: edgePickIndex };
  return { containerRef, edgePickIndexRef };
}

function buildOpts(overrides: Partial<UseCanvasInteractionsOpts> = {}): UseCanvasInteractionsOpts {
  const refs = makeRefs();
  const modRefs = {
    shiftHeldRef: { current: false },
    metaHeldRef: { current: false },
    zoomLensHeldRef: { current: false },
  };
  return {
    containerRef: refs.containerRef,
    edgePickIndexRef: refs.edgePickIndexRef,
    modifiers: modRefs,
    panBy: vi.fn(),
    zoomAt: vi.fn(),
    viewportWidth: 1000,
    viewportHeight: 800,
    ...overrides,
  };
}

function useHarness(opts: UseCanvasInteractionsOpts) {
  // Wrap so we can call useRef safely inside renderHook, even though
  // `useCanvasInteractions` itself does not need extra refs.
  useRef(null);
  return useCanvasInteractions(opts);
}

describe("useCanvasInteractions", () => {
  beforeEach(() => {
    viewportStore.setViewport({ x: 0, y: 0, scale: 1, width: 1000, height: 800 });
    interactionStore.resetSelection();
    interactionStore.clearPathQuery();
    sceneStore.setGraph({ files: [], fileEdges: [], comments: [] });
  });

  afterEach(() => {
    interactionStore.resetSelection();
    interactionStore.clearPathQuery();
  });

  it("selectFile updates the interaction store's selectedFileId (no drag)", () => {
    const opts = buildOpts();
    const { result } = renderHook(() => useHarness(opts));

    act(() => { result.current.selectFile("alpha"); });
    expect(interactionStore.getState().viewState.selectedFileId).toBe("alpha");
  });

  it("hoverFile writes to viewState.hoveredFileId", () => {
    const opts = buildOpts();
    const { result } = renderHook(() => useHarness(opts));

    act(() => { result.current.hoverFile("h1"); });
    expect(interactionStore.getState().viewState.hoveredFileId).toBe("h1");
    act(() => { result.current.hoverFile(null); });
    expect(interactionStore.getState().viewState.hoveredFileId).toBeNull();
  });

  it("onZoomIn / onZoomOut call zoomAt centered in viewport with opposite deltas", () => {
    const zoomAt = vi.fn();
    const opts = buildOpts({ zoomAt });
    const { result } = renderHook(() => useHarness(opts));

    act(() => { result.current.onZoomIn(); });
    expect(zoomAt).toHaveBeenCalledWith(0.25, 500, 400);
    act(() => { result.current.onZoomOut(); });
    expect(zoomAt).toHaveBeenCalledWith(-0.25, 500, 400);
  });

  it("shift+click after an initial selection stores a pathQuery (source → target)", () => {
    const shiftHeldRef = { current: true };
    const opts: UseCanvasInteractionsOpts = {
      ...buildOpts(),
      modifiers: {
        shiftHeldRef,
        metaHeldRef: { current: false },
        zoomLensHeldRef: { current: false },
      },
    };
    const { result } = renderHook(() => useHarness(opts));

    // First click: shift is held but there is no prior selection, so the
    // hook falls through to plain selectFile(a).
    act(() => { result.current.selectFile("a"); });
    // Second click: now prevSel = "a", shift is still held, new id differs.
    act(() => { result.current.selectFile("b"); });

    const q = interactionStore.getState().pathQuery;
    expect(q).toMatchObject({ sourceFileId: "a", targetFileId: "b", mode: "shortest" });
  });
});
