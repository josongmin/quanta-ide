import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useSmoothCamera } from "./use-smooth-camera";
import { viewportStore } from "../store/viewport-store";
import { featureFlagsStore } from "../store/feature-flags-store";

// rAF polyfill so tests can step the animation deterministically via
// vi.useFakeTimers(). Each frame advances performance.now() by 16ms.
function installRafPolyfill(): () => void {
  let nowMs = 0;
  const origNow = performance.now.bind(performance);
  const origRaf = globalThis.requestAnimationFrame;
  const origCaf = globalThis.cancelAnimationFrame;
  let nextId = 1;
  const pending = new Map<number, FrameRequestCallback>();
  vi.stubGlobal("performance", { ...performance, now: () => nowMs });
  globalThis.requestAnimationFrame = ((cb: FrameRequestCallback) => {
    const id = nextId++;
    pending.set(id, cb);
    setTimeout(() => {
      if (!pending.has(id)) return;
      pending.delete(id);
      nowMs += 16;
      cb(nowMs);
    }, 16);
    return id;
  }) as typeof requestAnimationFrame;
  globalThis.cancelAnimationFrame = ((id: number) => { pending.delete(id); }) as typeof cancelAnimationFrame;
  return () => {
    vi.stubGlobal("performance", { ...performance, now: origNow });
    globalThis.requestAnimationFrame = origRaf;
    globalThis.cancelAnimationFrame = origCaf;
  };
}

function resetViewport(): void {
  viewportStore.setViewport({ x: 0, y: 0, scale: 1, width: 800, height: 600 });
}

describe("use-smooth-camera", () => {
  let restoreRaf: () => void;

  beforeEach(() => {
    vi.useFakeTimers();
    restoreRaf = installRafPolyfill();
    resetViewport();
  });

  afterEach(() => {
    featureFlagsStore.setFlag("power.smoothCamera", true);
    restoreRaf();
    vi.useRealTimers();
    resetViewport();
  });

  it("with power.smoothCamera OFF, panTo instantly snaps the viewport", () => {
    featureFlagsStore.setFlag("power.smoothCamera", false);
    const { result } = renderHook(() => useSmoothCamera());
    act(() => { result.current.panTo(100, 200, 2); });
    const vp = viewportStore.getState().viewport;
    expect(vp.x).toBe(100);
    expect(vp.y).toBe(200);
    expect(vp.scale).toBe(2);
  });

  it("with flag ON, panTo tweens toward the target across rAF frames", () => {
    featureFlagsStore.setFlag("power.smoothCamera", true);
    const { result } = renderHook(() => useSmoothCamera());
    act(() => { result.current.panTo(100, 200, 1); });
    // After one frame we should be somewhere between start (0,0) and target (100, 200)
    act(() => { vi.advanceTimersByTime(16); });
    const mid = viewportStore.getState().viewport;
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(100);
    // Let the tween fully finish (durationMs defaults to 280ms, ease-out).
    act(() => { vi.advanceTimersByTime(1000); });
    const final = viewportStore.getState().viewport;
    expect(final.x).toBeCloseTo(100, 5);
    expect(final.y).toBeCloseTo(200, 5);
  });

  it("fitRect with flag off instantly fills rect", () => {
    featureFlagsStore.setFlag("power.smoothCamera", false);
    const { result } = renderHook(() => useSmoothCamera());
    act(() => { result.current.fitRect({ x: 0, y: 0, w: 400, h: 300 }, 1); });
    const vp = viewportStore.getState().viewport;
    // With fill=1 and 800x600 viewport over a 400x300 rect centered at
    // (200, 150), scale snaps to min(800/400, 600/300) = 2.
    expect(vp.scale).toBeCloseTo(2, 5);
    // Center of rect should land at center of viewport.
    expect(vp.x).toBeCloseTo(800 / 2 - 200 * 2, 5);
    expect(vp.y).toBeCloseTo(600 / 2 - 150 * 2, 5);
  });

  it("cancel() kills an in-flight tween so no further frames write the viewport", () => {
    featureFlagsStore.setFlag("power.smoothCamera", true);
    const { result } = renderHook(() => useSmoothCamera());
    act(() => { result.current.panTo(500, 500, 1); });
    act(() => { vi.advanceTimersByTime(16); });
    const mid = viewportStore.getState().viewport;
    act(() => { result.current.cancel(); });
    act(() => { vi.advanceTimersByTime(1000); });
    const after = viewportStore.getState().viewport;
    // Should be frozen at the mid-animation snapshot.
    expect(after.x).toBe(mid.x);
    expect(after.y).toBe(mid.y);
  });

  it("a second fitRect mid-animation cancels the prior tween and retargets", () => {
    featureFlagsStore.setFlag("power.smoothCamera", true);
    const { result } = renderHook(() => useSmoothCamera());
    act(() => { result.current.panTo(1000, 0, 1); });
    act(() => { vi.advanceTimersByTime(16); });
    act(() => { result.current.panTo(-1000, 0, 1); });
    act(() => { vi.advanceTimersByTime(1000); });
    const final = viewportStore.getState().viewport;
    // Final settle must match the *second* target, not the first.
    expect(final.x).toBeCloseTo(-1000, 5);
  });
});
