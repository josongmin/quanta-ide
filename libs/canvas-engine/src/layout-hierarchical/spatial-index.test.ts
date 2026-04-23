import { describe, it, expect } from "vitest";
import type { Rect } from "../graph/types";
import type { Entity } from "../entity/types";
import { LayoutSpatialIndex, worldViewportRect } from "./spatial-index";

function mkEntity(id: string, kind: Entity["kind"]): Entity {
  return {
    id,
    kind,
    name: id,
    path: id,
    parentId: null,
    childIds: [],
  };
}

describe("LayoutSpatialIndex", () => {
  it("returns empty for an unknown kind", () => {
    const idx = new LayoutSpatialIndex([], new Map());
    expect(idx.queryIds("building", { x: 0, y: 0, w: 100, h: 100 })).toEqual([]);
  });

  it("returns only entities whose rect intersects the query rect", () => {
    const entities: Entity[] = [
      mkEntity("a", "building"),
      mkEntity("b", "building"),
      mkEntity("c", "building"),
    ];
    const rects = new Map<string, Rect>([
      ["a", { x: 0, y: 0, w: 50, h: 50 }],
      ["b", { x: 200, y: 200, w: 50, h: 50 }], // outside query
      ["c", { x: 25, y: 25, w: 60, h: 60 }],   // partial overlap
    ]);
    const idx = new LayoutSpatialIndex(entities, rects);
    const hits = idx.queryIds("building", { x: 0, y: 0, w: 100, h: 100 });
    expect(hits.sort()).toEqual(["a", "c"]);
  });

  it("partitions by kind — queries never return other kinds", () => {
    const entities: Entity[] = [
      mkEntity("pkg", "galaxy"),
      mkEntity("file", "building"),
    ];
    const rects = new Map<string, Rect>([
      ["pkg", { x: 0, y: 0, w: 100, h: 100 }],
      ["file", { x: 0, y: 0, w: 100, h: 100 }],
    ]);
    const idx = new LayoutSpatialIndex(entities, rects);
    expect(idx.queryIds("galaxy", { x: 0, y: 0, w: 200, h: 200 })).toEqual(["pkg"]);
    expect(idx.queryIds("building", { x: 0, y: 0, w: 200, h: 200 })).toEqual(["file"]);
  });

  it("filterEntities preserves input order", () => {
    const entities: Entity[] = [
      mkEntity("a", "building"),
      mkEntity("b", "building"),
      mkEntity("c", "building"),
      mkEntity("d", "building"),
    ];
    const rects = new Map<string, Rect>([
      ["a", { x: 0, y: 0, w: 10, h: 10 }],
      ["b", { x: 500, y: 500, w: 10, h: 10 }], // outside
      ["c", { x: 20, y: 20, w: 10, h: 10 }],
      ["d", { x: 40, y: 40, w: 10, h: 10 }],
    ]);
    const idx = new LayoutSpatialIndex(entities, rects);
    const filtered = idx.filterEntities(entities, { x: 0, y: 0, w: 100, h: 100 });
    expect(filtered.map(e => e.id)).toEqual(["a", "c", "d"]);
  });

  it("scales to a large repo without blowing up", () => {
    const entities: Entity[] = [];
    const rects = new Map<string, Rect>();
    for (let i = 0; i < 10_000; i++) {
      const id = `f${i}`;
      entities.push(mkEntity(id, "building"));
      // Grid: 100 cols × 100 rows, 20×20 cards with 10px gap.
      const col = i % 100;
      const row = Math.floor(i / 100);
      rects.set(id, { x: col * 30, y: row * 30, w: 20, h: 20 });
    }
    const idx = new LayoutSpatialIndex(entities, rects);
    // Small viewport at the origin — should hit only a few dozen cells.
    const hits = idx.queryIds("building", { x: 0, y: 0, w: 150, h: 150 });
    expect(hits.length).toBeLessThan(40);
    expect(hits.length).toBeGreaterThan(0);
  });
});

describe("worldViewportRect", () => {
  it("converts camera transform into a world rect", () => {
    // Camera centered at (0,0), scale 1, 800×600 viewport.
    const r = worldViewportRect({ tx: 0, ty: 0, scale: 1 }, 800, 600);
    expect(r).toEqual({ x: 0, y: 0, w: 800, h: 600 });
  });

  it("expands the visible world rect as the camera zooms out", () => {
    const zoomedOut = worldViewportRect({ tx: 0, ty: 0, scale: 0.5 }, 800, 600);
    expect(zoomedOut.w).toBe(1600);
    expect(zoomedOut.h).toBe(1200);
  });

  it("shifts the world rect when the camera pans", () => {
    // Pan right by 100 px at scale 1 → world origin shifts left.
    const r = worldViewportRect({ tx: -100, ty: 0, scale: 1 }, 800, 600);
    expect(r.x).toBe(100);
  });

  it("guards zero/negative scale", () => {
    expect(worldViewportRect({ tx: 0, ty: 0, scale: 0 }, 800, 600)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
    expect(worldViewportRect({ tx: 0, ty: 0, scale: -1 }, 800, 600)).toEqual({ x: 0, y: 0, w: 0, h: 0 });
  });
});
