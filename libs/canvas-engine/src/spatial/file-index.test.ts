import { describe, it, expect } from "vitest";
import { FileIndex } from "./file-index";
import type { Rect } from "../graph/types";

function rect(x: number, y: number, w: number, h: number): Rect {
  return { x, y, w, h };
}

describe("FileIndex", () => {
  it("query() returns ids of rects intersecting the viewport", () => {
    const idx = new FileIndex();
    idx.load(new Map<string, Rect>([
      ["a", rect(0, 0, 50, 50)],
      ["b", rect(100, 100, 50, 50)],
      ["c", rect(200, 200, 50, 50)],
    ]));
    const hits = idx.query({ x: 40, y: 40, w: 80, h: 80 });
    expect(hits.sort()).toEqual(["a", "b"]);
  });

  it("query() returns empty when viewport doesn't intersect any file", () => {
    const idx = new FileIndex();
    idx.load(new Map<string, Rect>([["a", rect(0, 0, 10, 10)]]));
    expect(idx.query({ x: 500, y: 500, w: 10, h: 10 })).toEqual([]);
  });

  it("load() on a fresh map drops entries from the prior layout", () => {
    const idx = new FileIndex();
    idx.load(new Map<string, Rect>([["a", rect(0, 0, 10, 10)]]));
    expect(idx.query({ x: 0, y: 0, w: 10, h: 10 })).toEqual(["a"]);
    idx.load(new Map<string, Rect>([["b", rect(100, 100, 10, 10)]]));
    expect(idx.query({ x: 0, y: 0, w: 10, h: 10 })).toEqual([]);
    expect(idx.query({ x: 100, y: 100, w: 10, h: 10 })).toEqual(["b"]);
  });

  it("queryItems() returns raw bbox items with fileId", () => {
    const idx = new FileIndex();
    idx.load(new Map<string, Rect>([["a", rect(10, 20, 30, 40)]]));
    const items = idx.queryItems({ x: 0, y: 0, w: 100, h: 100 });
    expect(items).toHaveLength(1);
    expect(items[0].fileId).toBe("a");
    expect(items[0].minX).toBe(10);
    expect(items[0].maxX).toBe(40);
    expect(items[0].maxY).toBe(60);
  });

  it("clear() removes all entries", () => {
    const idx = new FileIndex();
    idx.load(new Map<string, Rect>([["a", rect(0, 0, 10, 10)]]));
    idx.clear();
    expect(idx.query({ x: -100, y: -100, w: 1000, h: 1000 })).toEqual([]);
  });

  it("point-within (1x1 viewport) returns the containing file", () => {
    const idx = new FileIndex();
    idx.load(new Map<string, Rect>([
      ["a", rect(0, 0, 100, 100)],
      ["b", rect(200, 0, 50, 50)],
    ]));
    expect(idx.query({ x: 50, y: 50, w: 0, h: 0 })).toEqual(["a"]);
  });
});
