import { useEffect, useRef } from "react";

// Pinch / two-finger pan / one-finger pan gesture machine for mobile and
// pen input. Separate from the desktop mouse path because:
//   - we need to track multiple active pointers (pinch needs 2)
//   - we must compute centroid + distance deltas, which have no mouse analog
//   - we must ignore mouse pointerevents so the existing onMouseDown/Move/Up
//     path stays the single source of truth for desktop pan
// The hook reuses the same panBy / zoomAt primitives as mouse + wheel, so
// bounds / anchor math stay in one place (use-canvas-viewport).

interface TouchGestureOpts {
  containerRef: React.RefObject<HTMLElement | null>;
  panBy: (dx: number, dy: number) => void;
  zoomAt: (delta: number, x: number, y: number) => void;
}

interface PointerPos {
  x: number;
  y: number;
}

// Exported so tests can drive the state machine directly without mounting
// a container. Keeps the react wrapper a thin useEffect around this class.
export class TouchGestureController {
  private readonly pointers = new Map<number, PointerPos>();
  private prevCentroid: PointerPos | null = null;
  private prevDistance = 0;

  constructor(
    private readonly panBy: (dx: number, dy: number) => void,
    private readonly zoomAt: (delta: number, x: number, y: number) => void,
  ) {}

  // Returns true if the event was consumed (touch/pen). Mouse pointer
  // events always return false so the outer mouse handlers keep ownership.
  down(e: PointerEvent, rect: DOMRect): boolean {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return false;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.pointers.set(e.pointerId, { x, y });
    this.recomputeAnchors();
    return true;
  }

  move(e: PointerEvent, rect: DOMRect): boolean {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return false;
    if (!this.pointers.has(e.pointerId)) return false;
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    this.pointers.set(e.pointerId, { x, y });

    const count = this.pointers.size;
    if (count === 1) {
      // Single touch → pan using centroid delta (centroid of 1 is the
      // point itself). recomputeAnchors ran on down, so prevCentroid is
      // set before the first move.
      const centroid = this.centroid();
      if (this.prevCentroid) {
        const dx = centroid.x - this.prevCentroid.x;
        const dy = centroid.y - this.prevCentroid.y;
        if (dx !== 0 || dy !== 0) this.panBy(dx, dy);
      }
      this.prevCentroid = centroid;
      return true;
    }

    if (count >= 2) {
      const centroid = this.centroid();
      const distance = this.distance();
      if (this.prevCentroid) {
        const dx = centroid.x - this.prevCentroid.x;
        const dy = centroid.y - this.prevCentroid.y;
        if (dx !== 0 || dy !== 0) this.panBy(dx, dy);
      }
      if (this.prevDistance > 0 && distance > 0) {
        // zoomAt takes a relative delta: newScale = scale * (1 + delta).
        // ratio - 1 converts absolute distance ratio into that form.
        const ratio = distance / this.prevDistance;
        const delta = ratio - 1;
        if (delta !== 0) this.zoomAt(delta, centroid.x, centroid.y);
      }
      this.prevCentroid = centroid;
      this.prevDistance = distance;
      return true;
    }
    return true;
  }

  up(e: PointerEvent): boolean {
    if (e.pointerType !== "touch" && e.pointerType !== "pen") return false;
    if (!this.pointers.has(e.pointerId)) return false;
    this.pointers.delete(e.pointerId);
    // Reanchor so the remaining pointer(s) don't see a phantom jump on
    // the next move (losing one finger of a pinch shifts the centroid).
    this.recomputeAnchors();
    return true;
  }

  // Test helper — inspect active pointer count.
  get activeCount(): number {
    return this.pointers.size;
  }

  private recomputeAnchors(): void {
    if (this.pointers.size === 0) {
      this.prevCentroid = null;
      this.prevDistance = 0;
      return;
    }
    this.prevCentroid = this.centroid();
    this.prevDistance = this.pointers.size >= 2 ? this.distance() : 0;
  }

  private centroid(): PointerPos {
    let sx = 0;
    let sy = 0;
    for (const p of this.pointers.values()) {
      sx += p.x;
      sy += p.y;
    }
    const n = this.pointers.size || 1;
    return { x: sx / n, y: sy / n };
  }

  private distance(): number {
    // Defined for count >= 2. For >2 we use the first two pointers — 3-finger
    // gestures aren't used on this canvas, so we don't overfit the math.
    const iter = this.pointers.values();
    const a = iter.next().value;
    const b = iter.next().value;
    if (!a || !b) return 0;
    const dx = a.x - b.x;
    const dy = a.y - b.y;
    return Math.hypot(dx, dy);
  }
}

export function useTouchGestures(opts: TouchGestureOpts): void {
  const { containerRef, panBy, zoomAt } = opts;
  // Keep callbacks fresh without re-binding listeners each render.
  const panByRef = useRef(panBy);
  const zoomAtRef = useRef(zoomAt);
  panByRef.current = panBy;
  zoomAtRef.current = zoomAt;

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ctrl = new TouchGestureController(
      (dx, dy) => panByRef.current(dx, dy),
      (delta, x, y) => zoomAtRef.current(delta, x, y),
    );

    const onDown = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (!ctrl.down(e, rect)) return;
      // Capture so pointermove keeps firing even when the finger slides
      // off the canvas root onto a child element.
      try {
        el.setPointerCapture(e.pointerId);
      } catch {
        // jsdom / older mobile browsers may throw on capture — safe to
        // ignore, the listeners still fire from the root.
      }
      e.preventDefault();
    };
    const onMove = (e: PointerEvent) => {
      const rect = el.getBoundingClientRect();
      if (!ctrl.move(e, rect)) return;
      e.preventDefault();
    };
    const onUp = (e: PointerEvent) => {
      if (!ctrl.up(e)) return;
      try {
        el.releasePointerCapture(e.pointerId);
      } catch {
        // Same rationale as setPointerCapture above.
      }
    };

    el.addEventListener("pointerdown", onDown);
    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerup", onUp);
    el.addEventListener("pointercancel", onUp);
    return () => {
      el.removeEventListener("pointerdown", onDown);
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerup", onUp);
      el.removeEventListener("pointercancel", onUp);
    };
  }, [containerRef]);
}
