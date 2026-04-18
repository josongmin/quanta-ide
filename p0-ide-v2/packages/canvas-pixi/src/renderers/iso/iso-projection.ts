// Cabinet projection helpers for the Action Terrain overlay.
// -------------------------------------------------------------------
// Cabinet projection (a subset of oblique projection) is the cheapest
// readable 3D illusion: the base rect stays in screen/world space and
// the "top" face is shifted by (z * xShiftPerZ, -z). We use it instead
// of full isometric because it overlays cleanly on existing 2D cards
// without transforming the whole stage.

export interface IsoConfig {
  /** Horizontal shift per world z-unit. Default 0.35. */
  xShiftPerZ: number;
  /** Max z-height in world units. Default 180. */
  maxZ: number;
}

export const DEFAULT_ISO_CONFIG: Readonly<IsoConfig> = {
  xShiftPerZ: 0.35,
  maxZ: 180,
};

/**
 * Project a world (x, y, z) point to cabinet-projected (x, y) in the
 * same world space. Consumer still multiplies by the viewport matrix.
 * z=0 is identity.
 */
export function projectIso(
  x: number,
  y: number,
  z: number,
  cfg: IsoConfig = DEFAULT_ISO_CONFIG,
): { x: number; y: number } {
  return { x: x + z * cfg.xShiftPerZ, y: y - z };
}

export interface IsoBoxFaces {
  /** Top face — 4 points × 2 components, CCW from TL. */
  top: readonly [number, number, number, number, number, number, number, number];
  /** Front (south) face — CCW. */
  front: readonly [number, number, number, number, number, number, number, number];
  /** Right (east) face — CCW, wound so the outward normal faces right. */
  right: readonly [number, number, number, number, number, number, number, number];
}

/**
 * Given a base rect in world coords and a z-height, return the 3
 * visible face polygons in CCW order. Suitable for Pixi.Graphics
 * `.poly(...)` fill or manual `.moveTo/.lineTo/.closePath/.fill`.
 *
 * At zHeight=0 top/front/right collapse (all points equal to the
 * base corners) — callers should skip drawing in that case to avoid
 * zero-area fills.
 */
export function buildIsoBoxFaces(
  rect: { x: number; y: number; w: number; h: number },
  zHeight: number,
  cfg: IsoConfig = DEFAULT_ISO_CONFIG,
): IsoBoxFaces {
  const dx = zHeight * cfg.xShiftPerZ;
  const dy = -zHeight;

  // Base rect corners (z=0).
  const bTLx = rect.x,          bTLy = rect.y;
  const bTRx = rect.x + rect.w, bTRy = rect.y;
  const bBRx = rect.x + rect.w, bBRy = rect.y + rect.h;
  const bBLx = rect.x,          bBLy = rect.y + rect.h;

  // Top face corners (z=zHeight).
  const tTLx = bTLx + dx, tTLy = bTLy + dy;
  const tTRx = bTRx + dx, tTRy = bTRy + dy;
  const tBRx = bBRx + dx, tBRy = bBRy + dy;
  const tBLx = bBLx + dx, tBLy = bBLy + dy;

  return {
    // Top face, CCW from top-left of the shifted rectangle.
    top: [
      tTLx, tTLy,
      tTRx, tTRy,
      tBRx, tBRy,
      tBLx, tBLy,
    ] as const,
    // Front (south) face. CCW: base bottom-left → base bottom-right
    // → top bottom-right → top bottom-left.
    front: [
      bBLx, bBLy,
      bBRx, bBRy,
      tBRx, tBRy,
      tBLx, tBLy,
    ] as const,
    // Right (east) face. Base top-right → base bottom-right → top
    // bottom-right → top top-right. Winds so outward normal faces
    // away from the box interior.
    right: [
      bTRx, bTRy,
      bBRx, bBRy,
      tBRx, tBRy,
      tTRx, tTRy,
    ] as const,
  };
}
