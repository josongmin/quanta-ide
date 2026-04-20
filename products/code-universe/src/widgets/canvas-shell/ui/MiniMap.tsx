import { useMemo, useRef, type CSSProperties, type PointerEvent, type ReactElement } from "react";
import type { Entity, HierarchicalLayout, Rect } from "@quanta/canvas-engine";

// MiniMap
// --------------------------------------------------------------------
// Fixed corner overlay showing the tier's entity rects in miniature
// plus a red viewport outline tracking the live camera. Read-only in
// Phase 6 — click-to-jump / drag-to-pan wait for a follow-up iteration
// (they need camera state lifted out of CanvasViewport).
//
// Kept as a pure SVG even though the main viewport is Pixi: mini
// scale (150px wide) has at most a few dozen visible rects, and SVG
// gets us crisp vector lines + trivial layout without standing up a
// second GL context.

const WIDTH = 180;
const HEIGHT = 120;
const PAD = 8;

const ROOT_STYLE: CSSProperties = {
  position: "absolute",
  right: 12,
  bottom: 12,
  width: WIDTH,
  height: HEIGHT,
  borderRadius: 8,
  border: "1px solid rgba(0,0,0,0.08)",
  background: "rgba(255,255,255,0.82)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  boxShadow: "0 2px 12px rgba(0,0,0,0.08)",
  overflow: "hidden",
  // `pointerEvents: auto` — the SVG inside handles clicks; the wrapper
  // div stays interactive so the click-to-jump shortcut works.
  pointerEvents: "auto",
  zIndex: 5,
};

interface Props {
  layout: HierarchicalLayout;
  visibleEntities: readonly Entity[];
  camera: { tx: number; ty: number; scale: number };
  viewportWidth: number;
  viewportHeight: number;
  /** Single-click / tween-on-release target. Called once per gesture
   *  end. Consumer typically tweens to this point. */
  onJump?: (worldX: number, worldY: number) => void;
  /** Fires continuously while the user drags inside the minimap. The
   *  consumer should SNAP camera (no tween) so cursor tracking feels
   *  locked 1:1 to the minimap. `onJump` still fires on release for a
   *  final settle tween if the viewport wants one. */
  onDragPan?: (worldX: number, worldY: number) => void;
}

export function MiniMap({
  layout,
  visibleEntities,
  camera,
  viewportWidth,
  viewportHeight,
  onJump,
  onDragPan,
}: Props): ReactElement | null {
  // Track whether the current gesture actually moved — a short click
  // (no drag) only fires `onJump`; a drag keeps calling `onDragPan`
  // and skips the final `onJump` (it'd double-snap otherwise).
  const gestureRef = useRef<{ id: number; moved: boolean } | null>(null);
  // Bounds of the entity rects at the current tier. Smaller than the
  // full `totalBounds` because tiers differ in extent (e.g. at
  // `room` tier the bounds are inside a single building).
  const bounds = useMemo(() => unionRects(visibleEntities, layout), [visibleEntities, layout]);
  if (!bounds || visibleEntities.length === 0) return null;

  const inner = { w: WIDTH - PAD * 2, h: HEIGHT - PAD * 2 };
  const fit = Math.min(inner.w / bounds.w, inner.h / bounds.h);
  const offsetX = PAD + (inner.w - bounds.w * fit) / 2;
  const offsetY = PAD + (inner.h - bounds.h * fit) / 2;
  const toMiniX = (x: number): number => offsetX + (x - bounds.x) * fit;
  const toMiniY = (y: number): number => offsetY + (y - bounds.y) * fit;
  const toMiniW = (w: number): number => w * fit;
  const toMiniH = (h: number): number => h * fit;

  // Convert camera → world-space rect that the canvas is currently
  // showing. The visible world rect is (0,0)→(vw,vh) in screen space,
  // mapped back through `inverse(camera)`.
  let camMini: Rect | null = null;
  if (camera.scale > 0 && viewportWidth > 0 && viewportHeight > 0) {
    const worldX = -camera.tx / camera.scale;
    const worldY = -camera.ty / camera.scale;
    const worldW = viewportWidth / camera.scale;
    const worldH = viewportHeight / camera.scale;
    camMini = {
      x: toMiniX(worldX),
      y: toMiniY(worldY),
      w: toMiniW(worldW),
      h: toMiniH(worldH),
    };
  }

  // Invert mini-map coords → world coords. Shared by click + drag.
  // Clamp to the bounded area so edge-margin pointer moves snap to
  // the nearest visible world point instead of extrapolating into
  // empty space.
  const toWorld = (e: PointerEvent<SVGSVGElement>): { x: number; y: number } => {
    const rect = e.currentTarget.getBoundingClientRect();
    const sx = e.clientX - rect.left;
    const sy = e.clientY - rect.top;
    const clampedX = Math.max(offsetX, Math.min(offsetX + bounds.w * fit, sx));
    const clampedY = Math.max(offsetY, Math.min(offsetY + bounds.h * fit, sy));
    return {
      x: (clampedX - offsetX) / fit + bounds.x,
      y: (clampedY - offsetY) / fit + bounds.y,
    };
  };

  const handlePointerDown = (e: PointerEvent<SVGSVGElement>): void => {
    if (!onJump && !onDragPan) return;
    if (e.button !== 0) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    gestureRef.current = { id: e.pointerId, moved: false };
    // First pointer sample also drives an immediate snap so the
    // camera jumps to where the user clicked even before they move.
    if (onDragPan) {
      const p = toWorld(e);
      onDragPan(p.x, p.y);
    }
  };

  const handlePointerMove = (e: PointerEvent<SVGSVGElement>): void => {
    const g = gestureRef.current;
    if (!g || g.id !== e.pointerId) return;
    g.moved = true;
    if (!onDragPan) return;
    const p = toWorld(e);
    onDragPan(p.x, p.y);
  };

  const handlePointerUp = (e: PointerEvent<SVGSVGElement>): void => {
    const g = gestureRef.current;
    if (!g || g.id !== e.pointerId) return;
    gestureRef.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* ignore */
    }
    // Click (not drag): fire the tween-style jump. Drags already
    // snapped continuously via `onDragPan`, so a terminal `onJump`
    // would double-apply the same target.
    if (!g.moved && onJump) {
      const p = toWorld(e);
      onJump(p.x, p.y);
    }
  };

  return (
    <div style={ROOT_STYLE} aria-label="Minimap">
      <svg
        width={WIDTH}
        height={HEIGHT}
        viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerCancel={handlePointerUp}
        style={{
          cursor: onJump || onDragPan ? "crosshair" : "default",
          touchAction: "none",
        }}
        role={onJump || onDragPan ? "button" : undefined}
        aria-label={
          onDragPan
            ? "Drag to pan camera, click to jump"
            : onJump
              ? "Click to jump camera"
              : undefined
        }
      >
        {visibleEntities.map(entity => {
          const r = layout.rects.get(entity.id);
          if (!r) return null;
          return (
            <rect
              key={entity.id}
              x={toMiniX(r.x)}
              y={toMiniY(r.y)}
              width={Math.max(1, toMiniW(r.w))}
              height={Math.max(1, toMiniH(r.h))}
              fill="#c7d2fe"
              opacity={0.6}
            />
          );
        })}
        {camMini && (
          <rect
            x={camMini.x}
            y={camMini.y}
            width={camMini.w}
            height={camMini.h}
            fill="rgba(239, 68, 68, 0.12)"
            stroke="#ef4444"
            strokeWidth={1.25}
            shapeRendering="crispEdges"
          />
        )}
      </svg>
    </div>
  );
}

function unionRects(entities: readonly Entity[], layout: HierarchicalLayout): Rect | null {
  let minX = Number.POSITIVE_INFINITY;
  let minY = Number.POSITIVE_INFINITY;
  let maxX = Number.NEGATIVE_INFINITY;
  let maxY = Number.NEGATIVE_INFINITY;
  let any = false;
  for (const e of entities) {
    const r = layout.rects.get(e.id);
    if (!r) continue;
    any = true;
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  if (!any) return null;
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
