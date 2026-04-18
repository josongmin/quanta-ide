import { useCallback, useEffect, useRef } from "react";
import { viewportStore } from "../store/viewport-store";
import { featureFlagsStore } from "../store/feature-flags-store";

// Smooth camera transitions (Batch 7 — power.smoothCamera).
// -------------------------------------------------------------------
// Wraps pan/zoom calls with a rAF-driven tween. When the feature flag
// is off we bypass the tween and write directly to the viewport store
// (preserves the existing instant-snap behaviour). When it's on we
// interpolate the current viewport toward the target over `durationMs`
// using a cubic ease-out curve.
//
// Interpolation formula (cubic ease-out): t' = 1 - (1 - t)^3
// Applied independently to x, y, and scale each frame:
//   x = startX + (targetX - startX) * eased
//
// Only this hook writes to `viewportStore` during a tween; any concurrent
// user pan/zoom cancels the in-flight animation. No smoothing is applied
// when the distance is sub-pixel (already there).

const DEFAULT_DURATION_MS = 280;
const EPS = 1e-4;

interface SmoothTarget {
  x: number;
  y: number;
  scale: number;
}

function easeOutCubic(t: number): number {
  const u = 1 - t;
  return 1 - u * u * u;
}

export interface UseSmoothCameraResult {
  /** Smoothly pan (and optionally zoom) toward world-anchored container coords. */
  panTo: (x: number, y: number, scale?: number, durationMs?: number) => void;
  /** Animate the camera so the given rect (world coords) fills the viewport. */
  fitRect: (rect: { x: number; y: number; w: number; h: number }, fill?: number, durationMs?: number) => void;
  /** Cancel any in-flight tween. */
  cancel: () => void;
}

export function useSmoothCamera(): UseSmoothCameraResult {
  const rafRef = useRef<number | null>(null);
  const startRef = useRef<SmoothTarget | null>(null);
  const targetRef = useRef<SmoothTarget | null>(null);
  const startedAtRef = useRef(0);
  const durationRef = useRef(DEFAULT_DURATION_MS);

  const cancel = useCallback(() => {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
    startRef.current = null;
    targetRef.current = null;
  }, []);

  const step = useCallback(() => {
    const start = startRef.current;
    const target = targetRef.current;
    if (!start || !target) { rafRef.current = null; return; }
    const now = performance.now();
    const dur = Math.max(1, durationRef.current);
    const t = Math.min(1, (now - startedAtRef.current) / dur);
    const e = easeOutCubic(t);
    const vp = viewportStore.getState().viewport;
    const nx = start.x + (target.x - start.x) * e;
    const ny = start.y + (target.y - start.y) * e;
    const ns = start.scale + (target.scale - start.scale) * e;
    viewportStore.setViewport({ ...vp, x: nx, y: ny, scale: ns });
    if (t >= 1) {
      startRef.current = null;
      targetRef.current = null;
      rafRef.current = null;
      return;
    }
    rafRef.current = requestAnimationFrame(step);
  }, []);

  const setTarget = useCallback((next: SmoothTarget, durationMs: number) => {
    const vp = viewportStore.getState().viewport;
    // Flag read at call time — toggling the flag live flips behaviour
    // without teardown. When off we just snap.
    if (!featureFlagsStore.isEnabled("power.smoothCamera")) {
      viewportStore.setViewport({ ...vp, x: next.x, y: next.y, scale: next.scale });
      return;
    }
    const dx = next.x - vp.x;
    const dy = next.y - vp.y;
    const ds = next.scale - vp.scale;
    if (Math.abs(dx) < EPS && Math.abs(dy) < EPS && Math.abs(ds) < EPS) return;
    if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    startRef.current = { x: vp.x, y: vp.y, scale: vp.scale };
    targetRef.current = next;
    startedAtRef.current = performance.now();
    durationRef.current = durationMs;
    rafRef.current = requestAnimationFrame(step);
  }, [step]);

  const panTo = useCallback((x: number, y: number, scale?: number, durationMs = DEFAULT_DURATION_MS) => {
    const vp = viewportStore.getState().viewport;
    setTarget({ x, y, scale: scale ?? vp.scale }, durationMs);
  }, [setTarget]);

  const fitRect = useCallback((
    rect: { x: number; y: number; w: number; h: number },
    fill = 0.85,
    durationMs = DEFAULT_DURATION_MS,
  ) => {
    const vp = viewportStore.getState().viewport;
    if (vp.width <= 0 || vp.height <= 0 || rect.w <= 0 || rect.h <= 0) return;
    const raw = Math.min(vp.width / rect.w, vp.height / rect.h) * fill;
    const scale = Math.min(2.5, Math.max(0.001, raw));
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const x = vp.width / 2 - cx * scale;
    const y = vp.height / 2 - cy * scale;
    setTarget({ x, y, scale }, durationMs);
  }, [setTarget]);

  useEffect(() => cancel, [cancel]);

  return { panTo, fitRect, cancel };
}
