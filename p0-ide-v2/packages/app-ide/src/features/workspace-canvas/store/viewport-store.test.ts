import { describe, it, expect, beforeEach, vi } from "vitest";
import { viewportStore } from "./viewport-store";
import type { Viewport } from "@quanta/canvas-engine";

describe("viewport-store", () => {
  beforeEach(() => {
    // Reset to a known baseline. setViewport short-circuits on equality so
    // we push a distinct value first, then zero it, to guarantee the
    // baseline emission lands before each test runs.
    viewportStore.setViewport({ x: 999, y: 999, scale: 1, width: 10, height: 10 });
    viewportStore.setViewport({ x: 0, y: 0, scale: 0.1, width: 0, height: 0 });
  });

  it("setViewport updates state and notifies subscribers", () => {
    const listener = vi.fn();
    const unsubscribe = viewportStore.subscribe(listener);
    const next: Viewport = { x: 10, y: 20, scale: 1, width: 800, height: 600 };
    viewportStore.setViewport(next);
    expect(viewportStore.getState().viewport).toEqual(next);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("setViewport short-circuits when every field is unchanged", () => {
    const same: Viewport = { x: 1, y: 2, scale: 0.5, width: 100, height: 200 };
    viewportStore.setViewport(same);
    const listener = vi.fn();
    const unsubscribe = viewportStore.subscribe(listener);
    // Re-apply structurally-identical viewport — no emission expected.
    viewportStore.setViewport({ x: 1, y: 2, scale: 0.5, width: 100, height: 200 });
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("setContainerSize short-circuits when width/height unchanged", () => {
    viewportStore.setContainerSize(640, 480);
    const listener = vi.fn();
    const unsubscribe = viewportStore.subscribe(listener);
    viewportStore.setContainerSize(640, 480);
    expect(listener).not.toHaveBeenCalled();
    // Changing either dimension DOES emit.
    viewportStore.setContainerSize(641, 480);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("subscribe returns an unsubscribe that stops notifications", () => {
    const listener = vi.fn();
    const unsubscribe = viewportStore.subscribe(listener);
    viewportStore.setViewport({ x: 5, y: 5, scale: 1, width: 10, height: 10 });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
    viewportStore.setViewport({ x: 6, y: 6, scale: 1, width: 10, height: 10 });
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
