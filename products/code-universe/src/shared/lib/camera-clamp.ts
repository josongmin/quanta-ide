import type { Rect } from "@quanta/canvas-engine";
import type { CameraState } from "./camera-animation";

// Figma-style soft camera clamp.
// --------------------------------------------------------------------
// Keep at least `MIN_WORLD_VISIBLE_PX` of the world's screen-space
// rect visible on both axes. If the user pans / zooms such that every
// pixel of the world would exit the viewport, snap the camera back so
// a sliver of the world stays in sight. Matches Figma's "you can pan
// into void but not disappear entirely" feel — critical at low zooms
// where one wheel tick can otherwise bury the entire map.
//
// Why a soft clamp instead of a hard "never leave bounds": the canvas
// is exploratory, so a little overshoot is fine and reads as the user
// reaching the edge of the world. A hard clamp would feel like a
// walled playground.

export const MIN_WORLD_VISIBLE_PX = 140;

export function clampCamera(
  c: CameraState,
  bounds: Rect,
  vpW: number,
  vpH: number,
  minVisible: number = MIN_WORLD_VISIBLE_PX,
): CameraState {
  if (bounds.w <= 0 || bounds.h <= 0 || vpW <= 0 || vpH <= 0) return c;
  const worldLeft = bounds.x * c.scale;
  const worldRight = (bounds.x + bounds.w) * c.scale;
  const worldTop = bounds.y * c.scale;
  const worldBottom = (bounds.y + bounds.h) * c.scale;
  // Required overlap can exceed the world's own screen size at extreme
  // zoom-outs, and it can exceed the viewport at microscopic worlds —
  // clamp the requirement down to whichever of (requested, worldSize,
  // viewportSize) is smallest so the bound stays satisfiable.
  const minOverlapX = Math.min(minVisible, worldRight - worldLeft, vpW);
  const minOverlapY = Math.min(minVisible, worldBottom - worldTop, vpH);
  const minTx = minOverlapX - worldRight;
  const maxTx = vpW - minOverlapX - worldLeft;
  const minTy = minOverlapY - worldBottom;
  const maxTy = vpH - minOverlapY - worldTop;
  const tx =
    minTx > maxTx
      ? (minTx + maxTx) / 2
      : Math.max(minTx, Math.min(maxTx, c.tx));
  const ty =
    minTy > maxTy
      ? (minTy + maxTy) / 2
      : Math.max(minTy, Math.min(maxTy, c.ty));
  return { tx, ty, scale: c.scale };
}
