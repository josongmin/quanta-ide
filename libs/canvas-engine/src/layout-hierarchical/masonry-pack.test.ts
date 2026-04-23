import { describe, it, expect } from "vitest";
import { masonryPack, unionRects } from "./masonry-pack";

describe("masonryPack", () => {
  it("returns zero-sized pack for empty input", () => {
    const r = masonryPack([]);
    expect(r.w).toBe(0);
    expect(r.h).toBe(0);
    expect(r.cols).toBe(0);
    expect(r.placements).toEqual([]);
  });

  it("places every item with a unique (x,y) coordinate", () => {
    const items = Array.from({ length: 12 }, (_, i) => ({ id: `i${i}`, w: 100, h: 50 + (i % 4) * 30 }));
    const r = masonryPack(items, 4);
    expect(r.placements).toHaveLength(12);
    const keys = new Set(r.placements.map(p => `${p.x},${p.y}`));
    expect(keys.size).toBe(12);
  });

  it("no placement exceeds pack bounds", () => {
    const items = Array.from({ length: 20 }, (_, i) => ({ id: `i${i}`, w: 80, h: 40 }));
    const r = masonryPack(items, 2);
    for (const p of r.placements) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.x + p.w).toBeLessThanOrEqual(r.w + 0.01);
      expect(p.y + p.h).toBeLessThanOrEqual(r.h + 0.01);
    }
  });

  it("column width equals the widest child (narrower items don't stretch)", () => {
    const items = [
      { id: "wide", w: 200, h: 50 },
      { id: "narrow", w: 100, h: 50 },
    ];
    const r = masonryPack(items, 0);
    const wide = r.placements.find(p => p.id === "wide")!;
    const narrow = r.placements.find(p => p.id === "narrow")!;
    expect(wide.w).toBe(200);
    expect(narrow.w).toBe(100); // stays at intrinsic width
  });

  it("shortest-column heuristic keeps columns balanced", () => {
    // 6 items: one huge (h=200), five small (h=30). Huge should anchor
    // one column; smalls infill the others → neither column is wildly
    // taller than the other.
    const items = [
      { id: "huge", w: 50, h: 200 },
      ...Array.from({ length: 5 }, (_, i) => ({ id: `s${i}`, w: 50, h: 30 })),
    ];
    const r = masonryPack(items, 0);
    const byCol = new Map<number, number>();
    for (const p of r.placements) {
      const col = Math.round(p.x / 50);
      byCol.set(col, Math.max(byCol.get(col) ?? 0, p.y + p.h));
    }
    const tops = [...byCol.values()];
    const tallest = Math.max(...tops);
    const shortest = Math.min(...tops);
    // Balanced: tallest column ≤ 4× the shortest (generous tolerance
    // since the 200-tall outlier anchors one column on its own; smalls
    // spread across the remaining columns).
    expect(tallest / shortest).toBeLessThan(4);
  });
});

describe("unionRects", () => {
  it("returns zero rect for empty array", () => {
    expect(unionRects([])).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });

  it("computes the bounding box of disjoint rects", () => {
    const u = unionRects([
      { x: 0, y: 0, w: 10, h: 20 },
      { x: 50, y: 30, w: 5, h: 5 },
    ]);
    expect(u).toEqual({ x: 0, y: 0, w: 55, h: 35 });
  });
});
