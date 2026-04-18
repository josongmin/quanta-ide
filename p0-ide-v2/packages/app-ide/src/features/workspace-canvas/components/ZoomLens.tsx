import { useEffect, useRef, useState } from "react";
import type { WorkspaceLayout } from "@quanta/canvas-engine";
import { useFeature } from "../store/feature-flags-store";
import { useViewportStore } from "../store/viewport-store";
import { useInteractionStore } from "../store/interaction-store";

// Zoom lens magnifier (Batch 7 — power.zoomLens).
// -------------------------------------------------------------------
// Active while the user holds the Z key (tracked in the shared modifier
// state hook). Renders a ~180px circular lens following the cursor with
// a zoomed-in rendering of the world underneath.
//
// Strategy: DOM approximation. Rather than running an extra Pixi render
// pass we project `layout.fileRects` into the lens' local frame using
// the current viewport × LENS_ZOOM. That's exact enough for the MVP —
// file rectangles are what the user visually parses at street/galaxy
// LOD, and the lens is most useful at galaxy where the Pixi cards are
// only a few pixels wide. Edges are intentionally omitted; the lens is
// for *pointing* ("which file is under my cursor?"), not for inspection.
//
// When the feature flag is off, or Z isn't held, the component returns
// null — no DOM, no listeners.

const LENS_SIZE = 180;
const LENS_RADIUS = LENS_SIZE / 2;
const LENS_ZOOM = 2;
const VIEWPORT_MARGIN = 40; // world-coords padding around the lens window

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>;
  layout: WorkspaceLayout | null;
  zoomLensHeldRef: React.MutableRefObject<boolean>;
}

interface CursorState {
  /** Container-space cursor coords. */
  x: number;
  y: number;
  inside: boolean;
}

export function ZoomLens({ containerRef, layout, zoomLensHeldRef }: Props) {
  const on = useFeature("power.zoomLens");
  const viewport = useViewportStore(s => s.viewport);
  const selectedId = useInteractionStore(s => s.viewState.selectedFileId);

  // Key held flag — polled on every pointermove via ref, but React state
  // is the rerender trigger. We set `active` on the first keydown after
  // cursor enters; unset on keyup or pointerleave.
  const [active, setActive] = useState(false);
  const [cursor, setCursor] = useState<CursorState>({ x: 0, y: 0, inside: false });
  const rafRef = useRef<number | null>(null);
  const pendingRef = useRef<CursorState | null>(null);

  useEffect(() => {
    if (!on) return;
    const el = containerRef.current;
    if (!el) return;

    const flush = () => {
      rafRef.current = null;
      const pending = pendingRef.current;
      if (!pending) return;
      pendingRef.current = null;
      setCursor(pending);
      setActive(pending.inside && zoomLensHeldRef.current);
    };
    const schedule = () => {
      if (rafRef.current !== null) return;
      rafRef.current = requestAnimationFrame(flush);
    };

    const onMove = (e: PointerEvent) => {
      const r = el.getBoundingClientRect();
      const x = e.clientX - r.left;
      const y = e.clientY - r.top;
      const inside = x >= 0 && y >= 0 && x < r.width && y < r.height;
      pendingRef.current = { x, y, inside };
      schedule();
    };
    const onLeave = () => {
      pendingRef.current = { x: 0, y: 0, inside: false };
      schedule();
    };
    const onKey = () => {
      // Reflect the current modifier ref on every key event so the lens
      // appears immediately when Z is pressed with the cursor already
      // inside, and vanishes on keyup without waiting for a pointer move.
      pendingRef.current = { ...(pendingRef.current ?? cursor) };
      schedule();
    };

    el.addEventListener("pointermove", onMove);
    el.addEventListener("pointerleave", onLeave);
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      el.removeEventListener("pointermove", onMove);
      el.removeEventListener("pointerleave", onLeave);
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [on, containerRef, cursor, zoomLensHeldRef]);

  if (!on || !active || !layout) return null;
  if (viewport.scale <= 0) return null;

  // World-space coordinate of the cursor (the centre of the lens).
  const worldX = (cursor.x - viewport.x) / viewport.scale;
  const worldY = (cursor.y - viewport.y) / viewport.scale;

  // Effective zoom inside the lens = base viewport scale × LENS_ZOOM.
  const eff = viewport.scale * LENS_ZOOM;

  // World-coords window visible inside the lens (+ small margin so cards
  // that straddle the rim are still painted).
  const halfWorld = LENS_RADIUS / eff;
  const worldMinX = worldX - halfWorld - VIEWPORT_MARGIN;
  const worldMinY = worldY - halfWorld - VIEWPORT_MARGIN;
  const worldMaxX = worldX + halfWorld + VIEWPORT_MARGIN;
  const worldMaxY = worldY + halfWorld + VIEWPORT_MARGIN;

  // Project a world point into lens-local coords:
  //   lx = (wx - worldX) * eff + LENS_RADIUS
  //   ly = (wy - worldY) * eff + LENS_RADIUS
  const rects: Array<{ id: string; x: number; y: number; w: number; h: number }> = [];
  for (const [id, r] of layout.fileRects.entries()) {
    if (r.x + r.w < worldMinX) continue;
    if (r.x > worldMaxX) continue;
    if (r.y + r.h < worldMinY) continue;
    if (r.y > worldMaxY) continue;
    rects.push({
      id,
      x: (r.x - worldX) * eff + LENS_RADIUS,
      y: (r.y - worldY) * eff + LENS_RADIUS,
      w: r.w * eff,
      h: r.h * eff,
    });
  }

  return (
    <div
      className="ws-zoom-lens"
      style={{
        left: cursor.x - LENS_RADIUS,
        top: cursor.y - LENS_RADIUS,
        width: LENS_SIZE,
        height: LENS_SIZE,
      }}
      aria-hidden="true"
    >
      <div className="ws-zoom-lens__surface">
        {rects.map(rect => (
          <div
            key={rect.id}
            className={`ws-zoom-lens__rect${selectedId === rect.id ? " is-selected" : ""}`}
            style={{
              left: rect.x,
              top: rect.y,
              width: Math.max(1, rect.w),
              height: Math.max(1, rect.h),
            }}
          />
        ))}
      </div>
    </div>
  );
}
