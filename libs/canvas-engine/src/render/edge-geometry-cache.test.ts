import { describe, it, expect } from "vitest";
import { EdgeGeometryCache } from "./edge-geometry-cache";
import type { FileEdge } from "../graph/types";
import type { WorkspaceLayout, BezierRoute } from "../layout/types";

function makeEdge(id: string, from = "a", to = "b"): FileEdge {
  return { id, from, to, kind: "import", layer: "structural", weight: 1 };
}

function makeRoute(x1: number, y1: number, x2: number, y2: number): BezierRoute {
  return {
    x1, y1,
    cx1: x1 + (x2 - x1) / 3, cy1: y1 + (y2 - y1) / 3,
    cx2: x1 + (2 * (x2 - x1)) / 3, cy2: y1 + (2 * (y2 - y1)) / 3,
    x2, y2,
  };
}

function makeLayout(routes: Map<string, BezierRoute>): WorkspaceLayout {
  return {
    fileRects: new Map(),
    edgeRoutes: routes,
    aggregates: {
      commentsByFunction: new Map(),
      commentsByFile: new Map(),
      commentedLines: new Map(),
    },
    totalBounds: { x: 0, y: 0, w: 1000, h: 1000 },
  };
}

describe("EdgeGeometryCache", () => {
  it("build() populates cache; get() returns geometry with bbox", () => {
    const cache = new EdgeGeometryCache();
    const routes = new Map<string, BezierRoute>([["e1", makeRoute(0, 0, 100, 50)]]);
    cache.build([makeEdge("e1")], makeLayout(routes));
    const geo = cache.get("e1");
    expect(geo).toBeDefined();
    expect(geo!.bbox).toEqual({ x: 0, y: 0, w: 100, h: 50 });
    expect(geo!.x2).toBe(100);
  });

  it("get() returns undefined on cache miss", () => {
    const cache = new EdgeGeometryCache();
    cache.build([], makeLayout(new Map()));
    expect(cache.get("missing")).toBeUndefined();
  });

  it("second build() replaces prior entries (layout invalidation)", () => {
    const cache = new EdgeGeometryCache();
    cache.build([makeEdge("e1")], makeLayout(new Map([["e1", makeRoute(0, 0, 10, 10)]])));
    expect(cache.get("e1")?.x2).toBe(10);
    // New layout — same edge id, new coordinates. Old entry must be dropped.
    cache.build([makeEdge("e1")], makeLayout(new Map([["e1", makeRoute(0, 0, 200, 200)]])));
    expect(cache.get("e1")?.x2).toBe(200);
  });

  it("skips edges whose route is absent from the layout", () => {
    const cache = new EdgeGeometryCache();
    const routes = new Map<string, BezierRoute>([["e1", makeRoute(0, 0, 10, 10)]]);
    cache.build([makeEdge("e1"), makeEdge("e2")], makeLayout(routes));
    expect(cache.get("e1")).toBeDefined();
    expect(cache.get("e2")).toBeUndefined();
  });

  it("clear() empties the cache", () => {
    const cache = new EdgeGeometryCache();
    cache.build([makeEdge("e1")], makeLayout(new Map([["e1", makeRoute(0, 0, 5, 5)]])));
    cache.clear();
    expect(cache.get("e1")).toBeUndefined();
  });

  it("handles 1000-entry build without leaking prior entries", () => {
    const cache = new EdgeGeometryCache();
    const edges: FileEdge[] = [];
    const routes = new Map<string, BezierRoute>();
    for (let i = 0; i < 1000; i++) {
      edges.push(makeEdge(`e${i}`));
      routes.set(`e${i}`, makeRoute(i, i, i + 10, i + 10));
    }
    cache.build(edges, makeLayout(routes));
    expect(cache.get("e0")?.x2).toBe(10);
    expect(cache.get("e999")?.x2).toBe(1009);
    // Rebuild with only one edge — the other 999 must be gone.
    cache.build([makeEdge("e0")], makeLayout(new Map([["e0", makeRoute(0, 0, 1, 1)]])));
    expect(cache.get("e500")).toBeUndefined();
    expect(cache.get("e0")).toBeDefined();
  });
});
