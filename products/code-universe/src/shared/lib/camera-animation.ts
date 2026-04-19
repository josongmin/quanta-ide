// Camera animation helper
// --------------------------------------------------------------------
// RAF-driven cubic-ease tween between camera states. Stateless in
// terms of React — consumers call `startTween()` with current/target
// and an `onUpdate` callback, and receive a `cancel` function for
// cleanup on unmount.
//
// Why hand-rolled instead of a spring library: tween has a single
// job (advance one frame, interpolate, call back), and an external
// dep here would be >1KB gzipped for ~20 lines of logic. If later
// phases need physics-correct bounces we swap; not until.

export interface CameraState {
  tx: number;
  ty: number;
  scale: number;
}

export interface TweenHandle {
  /** Cancel the tween immediately. Idempotent. */
  cancel(): void;
}

const DEFAULT_DURATION_MS = 320;

/**
 * Kick off an ease-out-cubic tween from `from` to `to`, calling
 * `onUpdate` on each frame. Returns a cancel handle — attach it to
 * the effect cleanup or call when a new tween supersedes this one.
 */
export function startCameraTween(
  from: CameraState,
  to: CameraState,
  onUpdate: (c: CameraState) => void,
  durationMs: number = DEFAULT_DURATION_MS,
): TweenHandle {
  let rafId: number | null = null;
  let cancelled = false;
  const startTs = performance.now();

  const tick = (now: number) => {
    if (cancelled) return;
    const t = Math.min(1, (now - startTs) / durationMs);
    const e = easeOutCubic(t);
    const c: CameraState = {
      tx: from.tx + (to.tx - from.tx) * e,
      ty: from.ty + (to.ty - from.ty) * e,
      scale: from.scale + (to.scale - from.scale) * e,
    };
    onUpdate(c);
    if (t < 1) rafId = requestAnimationFrame(tick);
  };
  rafId = requestAnimationFrame(tick);

  return {
    cancel() {
      cancelled = true;
      if (rafId !== null) cancelAnimationFrame(rafId);
      rafId = null;
    },
  };
}

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}
