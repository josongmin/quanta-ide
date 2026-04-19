import { describe, it, expect } from "vitest";
import { SpatialPickIndex, type PickRect } from "./SpatialPickIndex";

// Pure RBush wrapper — no Pixi dependency. These tests verify:
//   - load() builds a queryable tree from PickRects
//   - pickAt() returns the topmost (last-inserted) id at a point
//   - load() is a no-op when id+rounded-geometry is unchanged
//   - kindKey namespaces the cache so galaxy/cluster don't false-hit
//   - clear() wipes the tree and cache key so the next load re-indexes

function r(id: string, x: number, y: number, w: number, h: number): PickRect {
  return { id, x, y, w, h };
}

describe("SpatialPickIndex.load + pickAt", () => {
  it("returns the id whose rect contains the point", () => {
    const idx = new SpatialPickIndex();
    idx.load([r("a", 0, 0, 10, 10), r("b", 100, 100, 10, 10)]);
    expect(idx.pickAt(5, 5)).toBe("a");
    expect(idx.pickAt(105, 105)).toBe("b");
    expect(idx.pickAt(50, 50)).toBeNull();
  });

  it("returns the topmost (highest insertion index) id when rects overlap", () => {
    const idx = new SpatialPickIndex();
    // Both rects contain (5, 5) — b is later in the list, so it wins.
    idx.load([r("a", 0, 0, 20, 20), r("b", 0, 0, 20, 20)]);
    expect(idx.pickAt(5, 5)).toBe("b");
  });

  it("empty load leaves pickAt returning null", () => {
    const idx = new SpatialPickIndex();
    idx.load([]);
    expect(idx.pickAt(0, 0)).toBeNull();
  });
});

describe("SpatialPickIndex cache key", () => {
  it("returns false on a second load with the same id+geometry set", () => {
    const idx = new SpatialPickIndex();
    expect(idx.load([r("a", 0, 0, 10, 10)])).toBe(true);
    // Same set → cache hit → skip rebuild.
    expect(idx.load([r("a", 0, 0, 10, 10)])).toBe(false);
  });

  it("rebuilds when ids change even at the same geometry", () => {
    const idx = new SpatialPickIndex();
    idx.load([r("a", 0, 0, 10, 10)]);
    expect(idx.load([r("b", 0, 0, 10, 10)])).toBe(true);
    expect(idx.pickAt(5, 5)).toBe("b");
  });

  it("kindKey namespaces the cache — same rects under different kinds both rebuild", () => {
    const idx = new SpatialPickIndex();
    const rects = [r("a", 0, 0, 10, 10)];
    expect(idx.load(rects, "galaxy")).toBe(true);
    // Second load with a different kindKey must rebuild (different namespace).
    expect(idx.load(rects, "cluster")).toBe(true);
  });
});

describe("SpatialPickIndex.clear", () => {
  it("empties the tree and resets the cache key so next load rebuilds", () => {
    const idx = new SpatialPickIndex();
    idx.load([r("a", 0, 0, 10, 10)]);
    idx.clear();
    expect(idx.pickAt(5, 5)).toBeNull();
    // Cache was reset — the "same" load must report a fresh rebuild.
    expect(idx.load([r("a", 0, 0, 10, 10)])).toBe(true);
    expect(idx.pickAt(5, 5)).toBe("a");
  });
});
