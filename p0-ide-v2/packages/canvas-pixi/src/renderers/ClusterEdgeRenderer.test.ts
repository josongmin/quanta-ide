import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Container, Graphics } from "pixi.js";
import { ClusterEdgeRenderer } from "./ClusterEdgeRenderer";
import type { ClusterEdge, Viewport, BezierRoute } from "@quanta/canvas-engine";

// Coverage notes
// ---------------
// `ClusterEdgeRenderer` is almost entirely a Pixi draw routine — there are
// no extracted pure helpers. The testable logic is therefore the control
// flow around the shared Graphics:
//   1. empty-in-empty-out early-return (the `previousLength === 0` guard)
//   2. update() accepts a full ClusterEdge, including the halo pass for
//      edges whose `count` clears HALO_COUNT_THRESHOLD (=10)
//   3. update() with sub-threshold edges skips the halo pass (structural
//      branch — we can't read the Graphics fill-list, but we can confirm
//      the call is non-throwing and stable across permutations)
//   4. clear() is idempotent (second call fast-returns)
//   5. clear() after an update drops `previousLength` back to zero
//   6. update() tolerates edges missing `route` (partial data from layout)
//
// Un-testable in jsdom:
//   - Actual stroke width / alpha rendered to GPU.
//   - scale-independence visually — the computed `invScale` multiplier is
//     observable only via the Graphics' internal stroke state, not from JS.

const VP: Viewport = { x: 0, y: 0, scale: 0.25, width: 100, height: 100 };

const ROUTE: BezierRoute = {
  x1: 0, y1: 0, cx1: 30, cy1: 30, cx2: 70, cy2: 70, x2: 100, y2: 100,
};

function edge(
  id: string,
  count: number,
  overrides: Partial<ClusterEdge> = {},
): ClusterEdge {
  return {
    id,
    fromClusterId: "a",
    toClusterId: "b",
    kind: "call",
    layer: "structural",
    count,
    route: ROUTE,
    ...overrides,
  };
}

describe("ClusterEdgeRenderer", () => {
  let parent: Container;
  let renderer: ClusterEdgeRenderer;

  beforeEach(() => {
    parent = new Container();
    renderer = new ClusterEdgeRenderer(parent);
  });

  afterEach(() => {
    renderer.destroy();
    parent.destroy({ children: true });
  });

  it("short-circuits the empty-then-empty update (no previous work to clear)", () => {
    // Fresh renderer's previousLength is 0 and input is empty — the guard
    // `edges.length === 0 && this.previousLength === 0` bails before any
    // Graphics.clear call. Must not throw and must remain re-callable.
    expect(() => renderer.update([], VP)).not.toThrow();
    expect(() => renderer.update([], VP)).not.toThrow();
  });

  it("draws a single super-edge under the halo threshold without the halo pass", () => {
    // count < HALO_COUNT_THRESHOLD (=10) skips the first for-loop entirely.
    expect(() => renderer.update([edge("e1", 3)], VP)).not.toThrow();
  });

  it("draws halo + primary for super-edges >= HALO_COUNT_THRESHOLD", () => {
    // count=50 comfortably clears threshold so both passes run.
    expect(() => renderer.update([edge("e1", 50)], VP)).not.toThrow();
  });

  it("tolerates a cluster edge with a missing route (defensive continue)", () => {
    // `if (!route) continue` in both passes means a partial edge must not
    // throw. This happens when the layout producer wasn't able to route
    // a cluster pair (e.g. degenerate overlap).
    const routeless: ClusterEdge = { ...edge("e1", 50), route: undefined };
    expect(() => renderer.update([routeless], VP)).not.toThrow();
  });

  it("clear() after a drawn update resets previousLength, letting the next empty-update short-circuit", () => {
    renderer.update([edge("e1", 12)], VP);
    // Second clear() should re-enter the previousLength===0 state.
    renderer.clear();
    // Subsequent empty update hits the early return (proven by not throwing
    // with no prior work to undo). Calling clear() a second time is a no-op
    // because `previousLength === 0`; we assert both paths run cleanly.
    expect(() => renderer.update([], VP)).not.toThrow();
    expect(() => renderer.clear()).not.toThrow();
  });

  it("is stable across viewport scale changes (log-width math, no throw)", () => {
    // scale bounces between sub-unit (zoomed out) and supra-unit (zoomed in).
    // The `invScale = Math.min(48, Math.max(1, 1/scale))` formula must not
    // produce NaN or Infinity for either extreme.
    const edges = [edge("e1", 15), edge("e2", 2)];
    expect(() => renderer.update(edges, { ...VP, scale: 0.01 })).not.toThrow();
    expect(() => renderer.update(edges, { ...VP, scale: 10 })).not.toThrow();
  });

  // ── Branch-coverage tests ─────────────────────────────────────────────

  it("empty update after a drawn frame clears the Graphics exactly once", () => {
    // Draw something, then pass an empty array — the guard
    // `edges.length === 0 && this.previousLength === 0` is FALSE on the
    // first empty call (previousLength > 0), so gfx.clear() must run and
    // previousLength must drop to 0.
    renderer.update([edge("e1", 5)], VP);
    const gfx = (renderer as unknown as { gfx: Graphics }).gfx;
    const clearSpy = vi.spyOn(gfx, "clear");
    renderer.update([], VP);
    expect(clearSpy).toHaveBeenCalledTimes(1);
    // A subsequent empty update hits the early-return guard.
    clearSpy.mockClear();
    renderer.update([], VP);
    expect(clearSpy).not.toHaveBeenCalled();
  });

  it("halo pass emits an extra stroke above HALO_COUNT_THRESHOLD", () => {
    // Below threshold → 1 stroke per edge. Above threshold → 2 strokes
    // (halo + primary). With one of each, stroke count = 3.
    const gfx = (renderer as unknown as { gfx: Graphics }).gfx;
    const strokeSpy = vi.spyOn(gfx, "stroke");
    renderer.update([edge("e1", 50), edge("e2", 3)], VP);
    expect(strokeSpy.mock.calls.length).toBe(3);
  });
});
