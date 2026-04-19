import { describe, it, expect, vi } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useRef } from "react";
import { TouchGestureController, useTouchGestures } from "./use-touch-gestures";

// The state machine is tested directly (TouchGestureController) because it
// carries the load-bearing logic. The hook is covered with a smoke test
// that verifies listener wiring + mouse ignore.

function makeEvent(
  type: "pointerdown" | "pointermove" | "pointerup" | "pointercancel",
  init: { pointerId: number; clientX: number; clientY: number; pointerType?: string },
): PointerEvent {
  // jsdom supports PointerEvent via synthetic construction; fall back to
  // a plain object cast when PointerEvent is unavailable (older vitest).
  if (typeof PointerEvent === "function") {
    return new PointerEvent(type, {
      pointerId: init.pointerId,
      clientX: init.clientX,
      clientY: init.clientY,
      pointerType: init.pointerType ?? "touch",
      bubbles: true,
      cancelable: true,
    });
  }
  const evt = new Event(type, { bubbles: true, cancelable: true }) as PointerEvent & {
    pointerId: number; clientX: number; clientY: number; pointerType: string;
  };
  evt.pointerId = init.pointerId;
  evt.clientX = init.clientX;
  evt.clientY = init.clientY;
  evt.pointerType = init.pointerType ?? "touch";
  return evt;
}

const zeroRect: DOMRect = {
  x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0,
  toJSON: () => ({}),
};

describe("TouchGestureController", () => {
  it("1-touch drag fires panBy(dx, dy)", () => {
    const panBy = vi.fn();
    const zoomAt = vi.fn();
    const ctrl = new TouchGestureController(panBy, zoomAt);

    ctrl.down(makeEvent("pointerdown", { pointerId: 1, clientX: 100, clientY: 100 }), zeroRect);
    ctrl.move(makeEvent("pointermove", { pointerId: 1, clientX: 130, clientY: 120 }), zeroRect);
    ctrl.move(makeEvent("pointermove", { pointerId: 1, clientX: 150, clientY: 140 }), zeroRect);

    expect(panBy).toHaveBeenCalledTimes(2);
    expect(panBy).toHaveBeenNthCalledWith(1, 30, 20);
    expect(panBy).toHaveBeenNthCalledWith(2, 20, 20);
    expect(zoomAt).not.toHaveBeenCalled();
  });

  it("2-touch pinch-out fires zoomAt with positive delta at centroid", () => {
    const panBy = vi.fn();
    const zoomAt = vi.fn();
    const ctrl = new TouchGestureController(panBy, zoomAt);

    // Two fingers start 100px apart, centroid at (150, 100).
    ctrl.down(makeEvent("pointerdown", { pointerId: 1, clientX: 100, clientY: 100 }), zeroRect);
    ctrl.down(makeEvent("pointerdown", { pointerId: 2, clientX: 200, clientY: 100 }), zeroRect);
    // Move each finger outward, distance → 200, centroid unchanged.
    ctrl.move(makeEvent("pointermove", { pointerId: 1, clientX: 50, clientY: 100 }), zeroRect);
    ctrl.move(makeEvent("pointermove", { pointerId: 2, clientX: 250, clientY: 100 }), zeroRect);

    expect(zoomAt).toHaveBeenCalled();
    // Final call should have a strictly positive delta (distance grew).
    const lastCall = zoomAt.mock.calls[zoomAt.mock.calls.length - 1];
    expect(lastCall[0]).toBeGreaterThan(0);
    // Centroid at (150, 100).
    expect(lastCall[1]).toBeCloseTo(150, 5);
    expect(lastCall[2]).toBeCloseTo(100, 5);
  });

  it("2-touch pan (both touches move together) fires panBy; net zoom ratio is 1", () => {
    const panBy = vi.fn();
    const zoomAt = vi.fn();
    const ctrl = new TouchGestureController(panBy, zoomAt);

    ctrl.down(makeEvent("pointerdown", { pointerId: 1, clientX: 100, clientY: 100 }), zeroRect);
    ctrl.down(makeEvent("pointerdown", { pointerId: 2, clientX: 200, clientY: 100 }), zeroRect);
    // Translate both fingers by (40, 30). Per-event distance wobbles
    // because pointermove only updates one pointer at a time (browser
    // behavior), but once both have moved the distance equals the start.
    ctrl.move(makeEvent("pointermove", { pointerId: 1, clientX: 140, clientY: 130 }), zeroRect);
    ctrl.move(makeEvent("pointermove", { pointerId: 2, clientX: 240, clientY: 130 }), zeroRect);

    // Sum of pan deltas must equal the shared translation (40, 30).
    expect(panBy).toHaveBeenCalled();
    let sumX = 0;
    let sumY = 0;
    for (const [dx, dy] of panBy.mock.calls) {
      sumX += dx;
      sumY += dy;
    }
    expect(sumX).toBeCloseTo(40, 5);
    expect(sumY).toBeCloseTo(30, 5);
    // The product of zoom ratios across the whole gesture collapses to
    // 1 — wobble cancels — so the user sees no net zoom.
    let netRatio = 1;
    for (const [delta] of zoomAt.mock.calls) netRatio *= 1 + delta;
    expect(netRatio).toBeCloseTo(1, 5);
  });

  it("mouse pointer events are ignored (no handler fires)", () => {
    const panBy = vi.fn();
    const zoomAt = vi.fn();
    const ctrl = new TouchGestureController(panBy, zoomAt);

    const downConsumed = ctrl.down(
      makeEvent("pointerdown", { pointerId: 1, clientX: 100, clientY: 100, pointerType: "mouse" }),
      zeroRect,
    );
    const moveConsumed = ctrl.move(
      makeEvent("pointermove", { pointerId: 1, clientX: 130, clientY: 120, pointerType: "mouse" }),
      zeroRect,
    );
    const upConsumed = ctrl.up(
      makeEvent("pointerup", { pointerId: 1, clientX: 130, clientY: 120, pointerType: "mouse" }),
    );

    expect(downConsumed).toBe(false);
    expect(moveConsumed).toBe(false);
    expect(upConsumed).toBe(false);
    expect(panBy).not.toHaveBeenCalled();
    expect(zoomAt).not.toHaveBeenCalled();
  });

  it("pointerup on one of two touches cleanly drops back to 1-touch mode", () => {
    const panBy = vi.fn();
    const zoomAt = vi.fn();
    const ctrl = new TouchGestureController(panBy, zoomAt);

    ctrl.down(makeEvent("pointerdown", { pointerId: 1, clientX: 100, clientY: 100 }), zeroRect);
    ctrl.down(makeEvent("pointerdown", { pointerId: 2, clientX: 200, clientY: 100 }), zeroRect);
    expect(ctrl.activeCount).toBe(2);

    // Lift finger 2 — we're now in single-finger pan mode at (100, 100).
    ctrl.up(makeEvent("pointerup", { pointerId: 2, clientX: 200, clientY: 100 }));
    expect(ctrl.activeCount).toBe(1);

    panBy.mockClear();
    zoomAt.mockClear();
    // Move remaining finger — must be a clean pan with no phantom zoom.
    ctrl.move(makeEvent("pointermove", { pointerId: 1, clientX: 150, clientY: 130 }), zeroRect);
    expect(panBy).toHaveBeenCalledTimes(1);
    expect(panBy).toHaveBeenCalledWith(50, 30);
    expect(zoomAt).not.toHaveBeenCalled();
  });

  it("pointercancel behaves like pointerup (finger removed)", () => {
    const panBy = vi.fn();
    const zoomAt = vi.fn();
    const ctrl = new TouchGestureController(panBy, zoomAt);

    ctrl.down(makeEvent("pointerdown", { pointerId: 1, clientX: 10, clientY: 10 }), zeroRect);
    ctrl.up(makeEvent("pointercancel", { pointerId: 1, clientX: 10, clientY: 10 }));
    expect(ctrl.activeCount).toBe(0);
  });
});

describe("useTouchGestures", () => {
  it("wires pointer listeners on the container and calls panBy on 1-touch drag", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const panBy = vi.fn();
    const zoomAt = vi.fn();

    function useHarness() {
      const ref = useRef<HTMLDivElement | null>(container);
      useTouchGestures({ containerRef: ref, panBy, zoomAt });
    }

    renderHook(() => useHarness());

    act(() => {
      container.dispatchEvent(new PointerEvent("pointerdown", {
        pointerId: 1, clientX: 50, clientY: 50, pointerType: "touch", bubbles: true, cancelable: true,
      }));
      container.dispatchEvent(new PointerEvent("pointermove", {
        pointerId: 1, clientX: 80, clientY: 70, pointerType: "touch", bubbles: true, cancelable: true,
      }));
    });

    expect(panBy).toHaveBeenCalledWith(30, 20);
    document.body.removeChild(container);
  });

  it("ignores mouse pointer events at the hook level", () => {
    const container = document.createElement("div");
    document.body.appendChild(container);
    const panBy = vi.fn();
    const zoomAt = vi.fn();

    function useHarness() {
      const ref = useRef<HTMLDivElement | null>(container);
      useTouchGestures({ containerRef: ref, panBy, zoomAt });
    }
    renderHook(() => useHarness());

    act(() => {
      container.dispatchEvent(new PointerEvent("pointerdown", {
        pointerId: 1, clientX: 50, clientY: 50, pointerType: "mouse", bubbles: true, cancelable: true,
      }));
      container.dispatchEvent(new PointerEvent("pointermove", {
        pointerId: 1, clientX: 80, clientY: 70, pointerType: "mouse", bubbles: true, cancelable: true,
      }));
    });

    expect(panBy).not.toHaveBeenCalled();
    expect(zoomAt).not.toHaveBeenCalled();
    document.body.removeChild(container);
  });
});
