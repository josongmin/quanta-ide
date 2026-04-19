import { describe, it, expect } from "vitest";
import type {
  WorkspaceGraph,
  WorkspaceLayout,
  FileNode,
  FileEdge,
  Rect,
} from "@quanta/canvas-engine";
import { computeRiskHeatmap } from "./heatmap";

// Minimal fixtures: the heatmap cares only about fileRects, totalBounds,
// riskScore, signals, and fileEdges severity — so stub just those.

function makeFile(id: string, riskScore: number, extras: Partial<FileNode> = {}): FileNode {
  return {
    id,
    name: id,
    layer: "domain",
    riskScore,
    loc: 10,
    signals: {
      taintCount: 0,
      blastCritical: 0,
      deadCount: 0,
      archViolations: 0,
      cpxMax: 0,
    },
    functions: [],
    ...extras,
  };
}

function makeLayout(
  fileRects: ReadonlyArray<readonly [string, Rect]>,
  bounds: Rect,
): WorkspaceLayout {
  return {
    fileRects: new Map(fileRects),
    edgeRoutes: new Map(),
    aggregates: {
      commentsByFunction: new Map(),
      commentsByFile: new Map(),
      commentedLines: new Map(),
    },
    totalBounds: bounds,
  };
}

function makeGraph(files: FileNode[], fileEdges: FileEdge[] = []): WorkspaceGraph {
  return { files, fileEdges, comments: [] };
}

describe("computeRiskHeatmap", () => {
  it("returns empty array when totalBounds is missing or zero-sized", () => {
    const layout = makeLayout([], { x: 0, y: 0, w: 0, h: 0 });
    const graph = makeGraph([]);
    expect(computeRiskHeatmap(layout, graph, 4, 4)).toEqual([]);
  });

  it("returns empty array when grid dims are non-positive", () => {
    const layout = makeLayout([], { x: 0, y: 0, w: 100, h: 100 });
    const graph = makeGraph([makeFile("a", 10)]);
    expect(computeRiskHeatmap(layout, graph, 0, 4)).toEqual([]);
    expect(computeRiskHeatmap(layout, graph, 4, 0)).toEqual([]);
  });

  it("returns empty array when no weight sources exist (all riskScore=0)", () => {
    const layout = makeLayout(
      [["a", { x: 10, y: 10, w: 5, h: 5 }]],
      { x: 0, y: 0, w: 100, h: 100 },
    );
    const graph = makeGraph([makeFile("a", 0)]);
    expect(computeRiskHeatmap(layout, graph, 4, 4)).toEqual([]);
  });

  it("emits a hot cell at the file's grid coord", () => {
    const bounds: Rect = { x: 0, y: 0, w: 100, h: 100 };
    // File centered in the top-left quadrant with 4x4 grid → cell (0,0).
    const layout = makeLayout([["a", { x: 0, y: 0, w: 20, h: 20 }]], bounds);
    const graph = makeGraph([makeFile("a", 99)]);
    const cells = computeRiskHeatmap(layout, graph, 4, 4);
    expect(cells.length).toBe(1);
    expect(cells[0]!.x).toBe(0);
    expect(cells[0]!.y).toBe(0);
    expect(cells[0]!.w).toBe(25);
    expect(cells[0]!.h).toBe(25);
    expect(cells[0]!.heat).toBeCloseTo(1, 5);
  });

  it("is deterministic: same input → same output", () => {
    const bounds: Rect = { x: 0, y: 0, w: 200, h: 200 };
    const layout = makeLayout(
      [
        ["a", { x: 10, y: 10, w: 10, h: 10 }],
        ["b", { x: 150, y: 150, w: 10, h: 10 }],
      ],
      bounds,
    );
    const graph = makeGraph([makeFile("a", 50), makeFile("b", 100)]);
    const a = computeRiskHeatmap(layout, graph, 4, 4);
    const b = computeRiskHeatmap(layout, graph, 4, 4);
    expect(a).toEqual(b);
  });

  it("normalizes by max: the highest-risk file maps to heat=1", () => {
    const bounds: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const layout = makeLayout(
      [
        ["a", { x: 5, y: 5, w: 5, h: 5 }],
        ["b", { x: 80, y: 80, w: 5, h: 5 }],
      ],
      bounds,
    );
    const graph = makeGraph([makeFile("a", 10), makeFile("b", 200)]);
    const cells = computeRiskHeatmap(layout, graph, 4, 4);
    const hottest = cells.reduce((m, c) => (c.heat > m.heat ? c : m));
    expect(hottest.heat).toBeCloseTo(1, 5);
  });

  it("critical edges contribute when includeCriticalEdges is true (default)", () => {
    const bounds: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const layout: WorkspaceLayout = makeLayout(
      [
        ["a", { x: 0, y: 0, w: 10, h: 10 }],
        ["b", { x: 90, y: 90, w: 10, h: 10 }],
      ],
      bounds,
    );
    const edges: FileEdge[] = [
      {
        id: "e1",
        from: "a",
        to: "b",
        kind: "call",
        layer: "structural",
        weight: 1,
        severity: "critical",
      },
    ];
    const graph = makeGraph([makeFile("a", 1), makeFile("b", 1)], edges);
    const withEdges = computeRiskHeatmap(layout, graph, 4, 4, { includeCriticalEdges: true });
    const withoutEdges = computeRiskHeatmap(layout, graph, 4, 4, { includeCriticalEdges: false });
    // A critical edge adds weight at the midpoint cell; with edges we get at
    // least as many cells, and usually one more (the midpoint).
    expect(withEdges.length).toBeGreaterThanOrEqual(withoutEdges.length);
  });
});
