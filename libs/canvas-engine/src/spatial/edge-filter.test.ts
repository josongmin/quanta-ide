import { describe, it, expect } from "vitest";
import { EdgeFilter } from "./edge-filter";
import type { BezierRoute } from "../layout/types";

function makeRoute(x1: number, y1: number, x2: number, y2: number): BezierRoute {
  return {
    x1, y1,
    cx1: x1 + (x2 - x1) / 3, cy1: y1 + (y2 - y1) / 3,
    cx2: x1 + (2 * (x2 - x1)) / 3, cy2: y1 + (2 * (y2 - y1)) / 3,
    x2, y2,
  };
}

describe("EdgeFilter", () => {
  it("query() returns edge ids whose bbox overlaps the viewport", () => {
    const filter = new EdgeFilter();
    const routes = new Map<string, BezierRoute>([
      ["e1", makeRoute(0, 0, 50, 50)],
      ["e2", makeRoute(200, 200, 250, 250)],
    ]);
    filter.load(["e1", "e2"], routes);
    expect(filter.query({ x: 0, y: 0, w: 100, h: 100 })).toEqual(["e1"]);
  });

  it("query() returns empty when viewport does not intersect any edge", () => {
    const filter = new EdgeFilter();
    filter.load(["e1"], new Map([["e1", makeRoute(0, 0, 10, 10)]]));
    expect(filter.query({ x: 500, y: 500, w: 10, h: 10 })).toEqual([]);
  });

  it("load() skips edge ids that have no route (no throw)", () => {
    const filter = new EdgeFilter();
    const routes = new Map<string, BezierRoute>([["present", makeRoute(0, 0, 10, 10)]]);
    expect(() => filter.load(["present", "missing"], routes)).not.toThrow();
    const hits = filter.query({ x: -10, y: -10, w: 1000, h: 1000 });
    expect(hits).toEqual(["present"]);
  });

  it("load() is a replacement — prior entries cleared", () => {
    const filter = new EdgeFilter();
    filter.load(["e1"], new Map([["e1", makeRoute(0, 0, 10, 10)]]));
    filter.load(["e2"], new Map([["e2", makeRoute(0, 0, 10, 10)]]));
    const hits = filter.query({ x: 0, y: 0, w: 10, h: 10 });
    expect(hits).toEqual(["e2"]);
  });

  it("queryItems() returns raw bbox items keyed by edgeId", () => {
    const filter = new EdgeFilter();
    filter.load(["e1"], new Map([["e1", makeRoute(10, 20, 100, 200)]]));
    const items = filter.queryItems({ x: 0, y: 0, w: 1000, h: 1000 });
    expect(items).toHaveLength(1);
    expect(items[0].edgeId).toBe("e1");
    expect(items[0].minX).toBe(10);
    expect(items[0].maxY).toBe(200);
  });

  it("clear() drops all indexed edges", () => {
    const filter = new EdgeFilter();
    filter.load(["e1"], new Map([["e1", makeRoute(0, 0, 10, 10)]]));
    filter.clear();
    expect(filter.query({ x: -100, y: -100, w: 1000, h: 1000 })).toEqual([]);
  });
});
