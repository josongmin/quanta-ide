import { describe, it, expect } from "vitest";
import {
  DEFAULT_ISO_CONFIG,
  projectIso,
  buildIsoBoxFaces,
} from "./iso-projection";

describe("DEFAULT_ISO_CONFIG", () => {
  it("is exported with the documented defaults", () => {
    expect(DEFAULT_ISO_CONFIG.xShiftPerZ).toBe(0.35);
    expect(DEFAULT_ISO_CONFIG.maxZ).toBe(180);
  });
});

describe("projectIso", () => {
  it("returns (x, y) exactly when z=0", () => {
    expect(projectIso(10, 20, 0)).toEqual({ x: 10, y: 20 });
  });

  it("shifts by (z * xShiftPerZ, -z) with default config", () => {
    expect(projectIso(0, 0, 100)).toEqual({ x: 35, y: -100 });
  });

  it("honours an explicit config", () => {
    expect(
      projectIso(0, 0, 100, { xShiftPerZ: 0.35, maxZ: 180 }),
    ).toEqual({ x: 35, y: -100 });
  });

  it("handles negative z (fix cones project downward)", () => {
    expect(projectIso(0, 0, -50)).toEqual({ x: -17.5, y: 50 });
  });
});

describe("buildIsoBoxFaces", () => {
  it("collapses all faces to the base rect when zHeight=0", () => {
    const faces = buildIsoBoxFaces({ x: 0, y: 0, w: 10, h: 10 }, 0);
    // With dx=dy=0, top corners equal base corners.
    expect(faces.top).toEqual([0, 0, 10, 0, 10, 10, 0, 10]);
    // Front face degenerate: bottom edge of base + bottom edge of "top" == same line.
    expect(faces.front).toEqual([0, 10, 10, 10, 10, 10, 0, 10]);
    // Right face degenerate: right edge of base + right edge of "top" == same line.
    expect(faces.right).toEqual([10, 0, 10, 10, 10, 10, 10, 0]);
  });

  it("produces the expected top face at zHeight=100", () => {
    const faces = buildIsoBoxFaces({ x: 0, y: 0, w: 10, h: 10 }, 100);
    // dx = 100 * 0.35 = 35, dy = -100.
    // TL (0,0) → (35,-100); TR (10,0) → (45,-100);
    // BR (10,10) → (45,-90); BL (0,10) → (35,-90).
    expect(faces.top).toEqual([35, -100, 45, -100, 45, -90, 35, -90]);
  });

  it("front face spans base bottom edge up to top bottom edge", () => {
    const faces = buildIsoBoxFaces({ x: 0, y: 0, w: 10, h: 10 }, 100);
    // CCW: bBL (0,10) → bBR (10,10) → tBR (45,-90) → tBL (35,-90).
    expect(faces.front).toEqual([0, 10, 10, 10, 45, -90, 35, -90]);
  });

  it("right face spans base right edge up to top right edge", () => {
    const faces = buildIsoBoxFaces({ x: 0, y: 0, w: 10, h: 10 }, 100);
    // bTR (10,0) → bBR (10,10) → tBR (45,-90) → tTR (45,-100).
    expect(faces.right).toEqual([10, 0, 10, 10, 45, -90, 45, -100]);
  });

  it("respects a custom xShiftPerZ", () => {
    const faces = buildIsoBoxFaces(
      { x: 0, y: 0, w: 10, h: 10 },
      100,
      { xShiftPerZ: 0.5, maxZ: 200 },
    );
    // dx = 100 * 0.5 = 50, dy = -100.
    expect(faces.top).toEqual([50, -100, 60, -100, 60, -90, 50, -90]);
  });

  it("translates the rect origin without distorting face shapes", () => {
    const a = buildIsoBoxFaces({ x: 0,   y: 0,   w: 10, h: 10 }, 50);
    const b = buildIsoBoxFaces({ x: 100, y: 200, w: 10, h: 10 }, 50);
    for (let i = 0; i < a.top.length; i += 2) {
      expect(b.top[i]).toBe(a.top[i] + 100);
      expect(b.top[i + 1]).toBe(a.top[i + 1] + 200);
    }
  });
});
