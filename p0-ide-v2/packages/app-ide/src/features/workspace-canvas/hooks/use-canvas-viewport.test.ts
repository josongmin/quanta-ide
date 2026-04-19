import { describe, it, expect, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useCanvasViewport, INITIAL_FIT_MAX_SCALE } from "./use-canvas-viewport";
import { viewportStore } from "../store/viewport-store";

// Covers the viewport hook's camera primitives: panBy, zoomAt,
// fitToGraph, setContainerSize. Uses the real viewportStore and resets
// it before each case — the hook is a thin façade over the store, so
// mocking would hide the store-write contract we care about.

function resetViewport(scale = 1): void {
  viewportStore.setViewport({ x: 0, y: 0, scale, width: 1000, height: 800 });
}

describe("useCanvasViewport", () => {
  beforeEach(() => {
    resetViewport();
  });

  it("panBy offsets x/y without touching scale", () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => { result.current.panBy(50, -30); });
    const vp = viewportStore.getState().viewport;
    expect(vp.x).toBe(50);
    expect(vp.y).toBe(-30);
    expect(vp.scale).toBe(1);
  });

  it("zoomAt clamps scale to upper bound (2.5)", () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => { result.current.zoomAt(100, 0, 0); });
    expect(viewportStore.getState().viewport.scale).toBeCloseTo(2.5, 5);
  });

  it("zoomAt clamps scale to lower bound (0.001)", () => {
    resetViewport(0.01);
    const { result } = renderHook(() => useCanvasViewport());
    // delta = -1 would multiply by 0, so use a strongly negative delta
    // that would drive scale far below the floor.
    act(() => { result.current.zoomAt(-0.999999, 0, 0); });
    expect(viewportStore.getState().viewport.scale).toBeGreaterThanOrEqual(0.001);
  });

  it("zoomAt preserves the world point under the anchor", () => {
    const { result } = renderHook(() => useCanvasViewport());
    const ax = 400;
    const ay = 300;
    // World point under anchor before zoom:
    const before = viewportStore.getState().viewport;
    const worldX = (ax - before.x) / before.scale;
    const worldY = (ay - before.y) / before.scale;
    act(() => { result.current.zoomAt(0.5, ax, ay); });
    const after = viewportStore.getState().viewport;
    const newWorldX = (ax - after.x) / after.scale;
    const newWorldY = (ay - after.y) / after.scale;
    expect(newWorldX).toBeCloseTo(worldX, 5);
    expect(newWorldY).toBeCloseTo(worldY, 5);
  });

  it("fitToGraph centers the graph and respects default max scale", () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => { result.current.fitToGraph(500, 400); });
    const vp = viewportStore.getState().viewport;
    // Expected scale = min(1000/500, 800/400) * 0.9 = 2 * 0.9 = 1.8 (< 2.5 cap).
    expect(vp.scale).toBeCloseTo(1.8, 5);
    // Centering invariants.
    expect(vp.x).toBeCloseTo((1000 - 500 * vp.scale) / 2, 5);
    expect(vp.y).toBeCloseTo((800 - 400 * vp.scale) / 2, 5);
  });

  it("fitToGraph respects the INITIAL_FIT_MAX_SCALE cap when passed", () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => { result.current.fitToGraph(100, 100, INITIAL_FIT_MAX_SCALE); });
    expect(viewportStore.getState().viewport.scale).toBeLessThanOrEqual(INITIAL_FIT_MAX_SCALE);
  });

  it("fitToGraph is a no-op when container or graph has zero dimension", () => {
    const { result } = renderHook(() => useCanvasViewport());
    const before = viewportStore.getState().viewport;
    act(() => { result.current.fitToGraph(0, 400); });
    act(() => { result.current.fitToGraph(500, 0); });
    const after = viewportStore.getState().viewport;
    expect(after).toEqual(before);
  });

  it("setContainerSize updates width/height without touching x/y/scale", () => {
    const { result } = renderHook(() => useCanvasViewport());
    act(() => { result.current.panBy(40, 60); });
    act(() => { result.current.setContainerSize(1200, 900); });
    const vp = viewportStore.getState().viewport;
    expect(vp.width).toBe(1200);
    expect(vp.height).toBe(900);
    expect(vp.x).toBe(40);
    expect(vp.y).toBe(60);
  });

  it("exports INITIAL_FIT_MAX_SCALE as a sub-MAX_SCALE constant", () => {
    expect(typeof INITIAL_FIT_MAX_SCALE).toBe("number");
    expect(INITIAL_FIT_MAX_SCALE).toBeGreaterThan(0);
    expect(INITIAL_FIT_MAX_SCALE).toBeLessThan(2.5);
  });
});
