import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { animateCameraTo, cancelCameraAnimation } from "./camera-animator";
import { viewportStore } from "../store/viewport-store";

// Drive the rAF-based tween with fake timers. The animator reads
// `performance.now()` and uses `requestAnimationFrame` to step; vitest's
// fake timers mock both by default, and `vi.advanceTimersByTime` also
// drives rAF callbacks because jsdom's rAF is setTimeout-backed.

function resetViewport(): void {
  viewportStore.setViewport({ x: 0, y: 0, scale: 1, width: 800, height: 600 });
}

describe("camera-animator", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    cancelCameraAnimation();
    resetViewport();
  });

  afterEach(() => {
    cancelCameraAnimation();
    vi.useRealTimers();
  });

  it("animateCameraTo returns a cancel handle", () => {
    const handle = animateCameraTo({ x: 100, y: 200, scale: 2 }, { durationMs: 100 });
    expect(typeof handle.cancel).toBe("function");
  });

  it("progresses the viewport toward the target over time", () => {
    animateCameraTo({ x: 1000, y: 0, scale: 1 }, { durationMs: 200 });
    // Step a few rAF ticks; exact count doesn't matter — we just need >0.
    vi.advanceTimersByTime(100);
    const mid = viewportStore.getState().viewport;
    expect(mid.x).toBeGreaterThan(0);
    expect(mid.x).toBeLessThan(1000);
  });

  it("completes the tween after full duration elapses", () => {
    animateCameraTo({ x: 500, y: -300, scale: 0.5 }, { durationMs: 100 });
    vi.advanceTimersByTime(500);
    const vp = viewportStore.getState().viewport;
    expect(vp.x).toBeCloseTo(500, 3);
    expect(vp.y).toBeCloseTo(-300, 3);
    expect(vp.scale).toBeCloseTo(0.5, 3);
  });

  it("cancel mid-tween freezes the viewport at its current value", () => {
    const handle = animateCameraTo({ x: 1000, y: 1000, scale: 1 }, { durationMs: 400 });
    vi.advanceTimersByTime(120);
    const frozen = { ...viewportStore.getState().viewport };
    handle.cancel();
    // Advance further — no more updates expected.
    vi.advanceTimersByTime(500);
    const after = viewportStore.getState().viewport;
    expect(after.x).toBe(frozen.x);
    expect(after.y).toBe(frozen.y);
    expect(after.scale).toBe(frozen.scale);
    // And we stopped before reaching the target.
    expect(after.x).toBeLessThan(1000);
  });

  it("starting a new tween supersedes the previous one", () => {
    animateCameraTo({ x: 1000, y: 0, scale: 1 }, { durationMs: 400 });
    vi.advanceTimersByTime(50);
    // Retarget — prior tween is cancelled by the new call.
    animateCameraTo({ x: -200, y: 0, scale: 1 }, { durationMs: 100 });
    vi.advanceTimersByTime(500);
    const vp = viewportStore.getState().viewport;
    expect(vp.x).toBeCloseTo(-200, 3);
  });

  it("ease curve is non-linear: 50%-elapsed progress exceeds the linear midpoint", () => {
    // easeOutCubic(0.5) = 1 - 0.5^3 = 0.875, so after half the duration the
    // viewport should be well past 50% of the way to the target.
    animateCameraTo({ x: 1000, y: 0, scale: 1 }, { durationMs: 200 });
    vi.advanceTimersByTime(100);
    const vp = viewportStore.getState().viewport;
    // Be loose: rAF cadence under fake timers isn't crisp, but the ease-out
    // should still clearly exceed the linear halfway mark.
    expect(vp.x).toBeGreaterThan(600);
  });

  it("onDone fires when the tween completes", () => {
    const onDone = vi.fn();
    animateCameraTo({ x: 10, y: 10, scale: 1 }, { durationMs: 50, onDone });
    vi.advanceTimersByTime(500);
    expect(onDone).toHaveBeenCalledTimes(1);
  });

  it("cancelCameraAnimation cancels any active tween", () => {
    animateCameraTo({ x: 1000, y: 0, scale: 1 }, { durationMs: 400 });
    vi.advanceTimersByTime(50);
    const frozen = { ...viewportStore.getState().viewport };
    cancelCameraAnimation();
    vi.advanceTimersByTime(500);
    expect(viewportStore.getState().viewport.x).toBe(frozen.x);
  });
});
