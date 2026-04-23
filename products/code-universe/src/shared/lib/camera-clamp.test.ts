import { describe, it, expect } from "vitest";
import { clampCamera } from "./camera-clamp";

// clampCamera contract:
// - camera tx/ty is snapped so at least `MIN_WORLD_VISIBLE_PX` of the
//   world rect stays visible in the viewport on each axis
// - if the world is smaller than that threshold, the clamp falls back
//   to a center-fit so the whole world stays in view
// - scale is never mutated (the clamp is positional only)

const bounds = { x: 0, y: 0, w: 2000, h: 1400 };
const VP = { w: 1400, h: 900 };
const MIN = 140;

describe("clampCamera", () => {
  it("leaves an in-range camera alone", () => {
    const c = { tx: 100, ty: 80, scale: 0.5 };
    const out = clampCamera(c, bounds, VP.w, VP.h);
    expect(out).toEqual(c);
  });

  it("snaps tx back when user pans the world off the left edge", () => {
    // scale 1, world x range on screen = [tx, tx+2000]. Required
    // overlap 140. If tx = -5000, world right edge at -5000+2000 = -3000
    // which is well left of viewport — clamp must lift tx up.
    const out = clampCamera({ tx: -5000, ty: 0, scale: 1 }, bounds, VP.w, VP.h);
    const worldRightScreen = (bounds.x + bounds.w) * out.scale + out.tx;
    expect(worldRightScreen).toBeGreaterThanOrEqual(MIN - 1e-6);
  });

  it("snaps tx back when user pans the world off the right edge", () => {
    const out = clampCamera({ tx: 5000, ty: 0, scale: 1 }, bounds, VP.w, VP.h);
    const worldLeftScreen = bounds.x * out.scale + out.tx;
    expect(worldLeftScreen).toBeLessThanOrEqual(VP.w - MIN + 1e-6);
  });

  it("keeps a tiny world visible even after a wild pan", () => {
    // At scale 0.01, world screen size = 20x14 — smaller than MIN=140.
    // Required overlap falls back to world's own size so the entire
    // world must stay inside the viewport. Clamp pulls the wildly-
    // off camera back in so every pixel of the world is rendered.
    const out = clampCamera({ tx: -9000, ty: -9000, scale: 0.01 }, bounds, VP.w, VP.h);
    const worldLeftScreen = bounds.x * out.scale + out.tx;
    const worldRightScreen = (bounds.x + bounds.w) * out.scale + out.tx;
    const worldTopScreen = bounds.y * out.scale + out.ty;
    const worldBottomScreen = (bounds.y + bounds.h) * out.scale + out.ty;
    expect(worldLeftScreen).toBeGreaterThanOrEqual(0 - 1e-6);
    expect(worldRightScreen).toBeLessThanOrEqual(VP.w + 1e-6);
    expect(worldTopScreen).toBeGreaterThanOrEqual(0 - 1e-6);
    expect(worldBottomScreen).toBeLessThanOrEqual(VP.h + 1e-6);
  });

  it("never mutates scale", () => {
    const out = clampCamera({ tx: 99999, ty: -99999, scale: 0.025 }, bounds, VP.w, VP.h);
    expect(out.scale).toBe(0.025);
  });

  it("is a no-op when bounds or viewport are degenerate", () => {
    const c = { tx: 10, ty: 20, scale: 1 };
    expect(clampCamera(c, { x: 0, y: 0, w: 0, h: 0 }, VP.w, VP.h)).toBe(c);
    expect(clampCamera(c, bounds, 0, 0)).toBe(c);
  });
});
