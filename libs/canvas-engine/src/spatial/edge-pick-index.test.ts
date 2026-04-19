import { describe, it, expect } from "vitest";
import { createEdgePickIndex } from "./edge-pick-index";
import type { FileEdge } from "../graph/types";
import type { WorkspaceLayout, BezierRoute } from "../layout/types";

function makeEdge(id: string, from: string, to: string): FileEdge {
  return { id, from, to, kind: "import", layer: "structural", weight: 1 };
}

function straightBezier(x1: number, y1: number, x2: number, y2: number): BezierRoute {
  const cx1 = x1 + (x2 - x1) / 3;
  const cy1 = y1 + (y2 - y1) / 3;
  const cx2 = x1 + (2 * (x2 - x1)) / 3;
  const cy2 = y1 + (2 * (y2 - y1)) / 3;
  return { x1, y1, cx1, cy1, cx2, cy2, x2, y2 };
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

describe("edge-pick-index", () => {
  it("picks the edge whose midpoint is nearest the cursor", () => {
    const e1 = makeEdge("e:a", "a", "b");
    const e2 = makeEdge("e:b", "c", "d");
    const e3 = makeEdge("e:c", "e", "f");
    const routes = new Map<string, BezierRoute>();
    routes.set(e1.id, straightBezier(0, 0, 100, 0));
    routes.set(e2.id, straightBezier(0, 100, 100, 100));
    routes.set(e3.id, straightBezier(0, 200, 100, 200));
    const layout = makeLayout(routes);

    const idx = createEdgePickIndex();
    idx.build([e1, e2, e3], layout);

    expect(idx.pickAt(50, 0, 8)?.id).toBe("e:a");
    expect(idx.pickAt(50, 100, 8)?.id).toBe("e:b");
    expect(idx.pickAt(50, 200, 8)?.id).toBe("e:c");
  });

  it("returns null when cursor is outside tolerance", () => {
    const e1 = makeEdge("e:a", "a", "b");
    const routes = new Map<string, BezierRoute>();
    routes.set(e1.id, straightBezier(0, 0, 100, 0));
    const layout = makeLayout(routes);
    const idx = createEdgePickIndex();
    idx.build([e1], layout);
    expect(idx.pickAt(500, 500, 8)).toBeNull();
  });

  it("picks endpoints and interior samples", () => {
    const e1 = makeEdge("e:a", "a", "b");
    const routes = new Map<string, BezierRoute>();
    routes.set(e1.id, straightBezier(0, 0, 150, 0));
    const layout = makeLayout(routes);
    const idx = createEdgePickIndex();
    idx.build([e1], layout);
    expect(idx.pickAt(0, 0, 2)?.id).toBe("e:a");
    expect(idx.pickAt(150, 0, 2)?.id).toBe("e:a");
    expect(idx.pickAt(75, 0, 6)?.id).toBe("e:a");
  });

  it("ties broken alphabetically by edge.id at crossover", () => {
    const eB = makeEdge("e:b", "x", "y");
    const eA = makeEdge("e:a", "p", "q");
    const routes = new Map<string, BezierRoute>();
    routes.set(eB.id, straightBezier(0, 0, 100, 100));
    routes.set(eA.id, straightBezier(0, 100, 100, 0));
    const layout = makeLayout(routes);
    const idx = createEdgePickIndex();
    idx.build([eB, eA], layout);
    const picked = idx.pickAt(50, 50, 8);
    expect(picked?.id).toBe("e:a");
  });

  it("hits anywhere along the curve at small (zoomed-in) tolerances", () => {
    // Regression: pickAt used to compare against 16 discrete bezier
    // samples, so at high zoom (small maxWorldPx) most of the curve
    // was unclickable — only tight blobs near each sample registered.
    // Segment-distance picking must hit any point on the polyline
    // regardless of where it falls between samples.
    const e1 = makeEdge("e:a", "a", "b");
    const routes = new Map<string, BezierRoute>();
    // Long horizontal segment — 16 samples puts ~133 world units
    // between adjacent samples, so a tol of 1 used to miss most x.
    routes.set(e1.id, straightBezier(0, 0, 2000, 0));
    const layout = makeLayout(routes);
    const idx = createEdgePickIndex();
    idx.build([e1], layout);
    for (let x = 0; x <= 2000; x += 50) {
      expect(idx.pickAt(x, 0, 1)?.id).toBe("e:a");
    }
  });

  it("clear wipes the index", () => {
    const e1 = makeEdge("e:a", "a", "b");
    const routes = new Map<string, BezierRoute>();
    routes.set(e1.id, straightBezier(0, 0, 100, 0));
    const layout = makeLayout(routes);
    const idx = createEdgePickIndex();
    idx.build([e1], layout);
    idx.clear();
    expect(idx.pickAt(50, 0, 8)).toBeNull();
  });
});
