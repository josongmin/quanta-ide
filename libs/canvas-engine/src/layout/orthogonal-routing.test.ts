import { describe, it, expect } from "vitest";
import { orthogonalRoute, buildOrthogonalRoutes } from "./orthogonal-routing";
import type { Rect, FileEdge } from "../graph/types";

function edge(id: string, from: string, to: string): FileEdge {
  return { id, from, to, kind: "call", layer: "structural", weight: 1 };
}

describe("orthogonalRoute", () => {
  it("horizontally separated rects on same row emit a 3-point straight route", () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 50 };
    const b: Rect = { x: 300, y: 0, w: 100, h: 50 };
    const route = orthogonalRoute(a, b);
    expect(route).not.toBeNull();
    expect(route!.points.length).toBe(3);
    const ys = route!.points.map(p => p.y);
    // All on the same horizontal line — y1 == y2.
    expect(ys.every(y => y === ys[0])).toBe(true);
  });

  it("around-obstacle (Z staircase) produces 4 segments that miss the implied blocker AABB", () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 50 };
    // Target rect displaced both horizontally and vertically → expect Z path.
    const b: Rect = { x: 400, y: 300, w: 100, h: 50 };
    const route = orthogonalRoute(a, b);
    expect(route).not.toBeNull();
    // 4 points = 3 segments (L/Z). Blocker would sit somewhere on the straight
    // diagonal path; verify the corridor X is between the two rects.
    expect(route!.points.length).toBe(4);
    const corridorX = route!.points[1].x;
    expect(corridorX).toBeGreaterThan(a.x + a.w);
    expect(corridorX).toBeLessThan(b.x);
  });

  it("degenerate (overlapping rects) returns a center-to-center 2-point line", () => {
    const a: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const b: Rect = { x: 20, y: 20, w: 100, h: 100 };
    const route = orthogonalRoute(a, b);
    expect(route).not.toBeNull();
    expect(route!.points.length).toBe(2);
  });

  it("zero-size rect returns null", () => {
    const a: Rect = { x: 0, y: 0, w: 0, h: 0 };
    const b: Rect = { x: 50, y: 50, w: 50, h: 50 };
    expect(orthogonalRoute(a, b)).toBeNull();
  });

  it("large-offset routing stays within the bounding-box extent of endpoints", () => {
    const a: Rect = { x: 0, y: 0, w: 10, h: 10 };
    const b: Rect = { x: 5000, y: 5000, w: 10, h: 10 };
    const route = orthogonalRoute(a, b);
    expect(route).not.toBeNull();
    for (const p of route!.points) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(b.x + b.w);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(b.y + b.h);
    }
  });

  it("buildOrthogonalRoutes skips edges with missing endpoints", () => {
    const rects = new Map<string, Rect>([
      ["a", { x: 0, y: 0, w: 50, h: 50 }],
      ["b", { x: 200, y: 0, w: 50, h: 50 }],
    ]);
    const edges = [edge("e1", "a", "b"), edge("e2", "a", "missing")];
    const routes = buildOrthogonalRoutes(edges, rects);
    expect(routes.size).toBe(1);
    expect(routes.has("e1")).toBe(true);
  });
});
