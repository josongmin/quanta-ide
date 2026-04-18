import { viewportStore } from "../store/viewport-store";

// Camera animator (Batch 5 — Navigation)
// -------------------------------------------------------------------
// Small rAF ease-out tween so bookmarks + storyboard don't snap.
// Duration scales with distance: short hops stay snappy (~80ms), big
// cross-canvas jumps feel cinematic (~800ms). Only one animation can
// be live at once — starting a new tween cancels the previous frame.
// Intentionally a local implementation: if a shared smooth-camera
// system lands in a future batch, swap this single helper without
// touching any caller.

export interface CameraTarget {
  x: number;
  y: number;
  scale: number;
}

interface TweenHandle {
  cancel(): void;
}

let activeHandle: TweenHandle | null = null;

/** Cubic ease-out — matches Figma/Miro tour pacing. */
function easeOutCubic(t: number): number {
  const inv = 1 - t;
  return 1 - inv * inv * inv;
}

function pickDurationMs(from: CameraTarget, to: CameraTarget): number {
  // Distance in screen-space terms: normalize world delta by the
  // current scale so a tiny 100px hop at zoom-out doesn't get
  // treated as a giant jump. Scale delta contributes too since a
  // zoom change feels further than its pixel delta suggests.
  const dx = (from.x - to.x);
  const dy = (from.y - to.y);
  const dist = Math.sqrt(dx * dx + dy * dy);
  const scaleDelta = Math.abs(Math.log2(Math.max(to.scale, 0.001) / Math.max(from.scale, 0.001)));
  const base = Math.min(dist / 8, 600);
  const zoomBoost = Math.min(scaleDelta * 120, 320);
  return Math.max(80, Math.min(800, base + zoomBoost));
}

export function cancelCameraAnimation(): void {
  if (activeHandle) {
    activeHandle.cancel();
    activeHandle = null;
  }
}

/**
 * Animate the viewport from its current camera to `target`.
 * Returns a cancelable handle; the tween is also cancelled when a new
 * call supersedes it.
 */
export function animateCameraTo(
  target: CameraTarget,
  opts?: { durationMs?: number; onDone?: () => void },
): TweenHandle {
  cancelCameraAnimation();

  const start = viewportStore.getState().viewport;
  const from: CameraTarget = { x: start.x, y: start.y, scale: start.scale };
  const duration = opts?.durationMs ?? pickDurationMs(from, target);
  const t0 = performance.now();
  let rafId = 0;
  let cancelled = false;

  const step = (now: number): void => {
    if (cancelled) return;
    const elapsed = now - t0;
    const raw = duration <= 0 ? 1 : Math.min(1, elapsed / duration);
    const k = easeOutCubic(raw);
    const vp = viewportStore.getState().viewport;
    viewportStore.setViewport({
      ...vp,
      x: from.x + (target.x - from.x) * k,
      y: from.y + (target.y - from.y) * k,
      scale: from.scale + (target.scale - from.scale) * k,
    });
    if (raw < 1) {
      rafId = requestAnimationFrame(step);
    } else {
      activeHandle = null;
      opts?.onDone?.();
    }
  };

  rafId = requestAnimationFrame(step);

  const handle: TweenHandle = {
    cancel(): void {
      if (cancelled) return;
      cancelled = true;
      if (rafId) cancelAnimationFrame(rafId);
      if (activeHandle === handle) activeHandle = null;
    },
  };
  activeHandle = handle;
  return handle;
}
