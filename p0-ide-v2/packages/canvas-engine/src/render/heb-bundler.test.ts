import { describe, it, expect } from "vitest";
import type { FileEdge, FileNode, Rect } from "../graph/types";
import { buildFolderTree, fillFolderCenters } from "../graph/folder-tree";
import { computeHEBPaths, sampleBspline } from "./heb-bundler";

function f(id: string): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "util",
    riskScore: 0,
    loc: 10,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
  };
}

function e(id: string, from: string, to: string): FileEdge {
  return { id, from, to, kind: "import", layer: "structural", weight: 1 };
}

describe("heb-bundler", () => {
  it("computes a sampled polyline per edge, starting at source and ending at target center", () => {
    const files = [f("src/a/x.ts"), f("src/b/y.ts")];
    const tree = buildFolderTree(files);
    const rects = new Map<string, Rect>([
      ["src/a/x.ts", { x: 0, y: 0, w: 10, h: 10 }],
      ["src/b/y.ts", { x: 100, y: 100, w: 10, h: 10 }],
    ]);
    fillFolderCenters(tree, rects);

    const paths = computeHEBPaths([e("e1", "src/a/x.ts", "src/b/y.ts")], rects, tree, {
      tension: 0.85,
      samples: 16,
    });

    expect(paths.length).toBe(1);
    const p = paths[0]!;
    expect(p.edgeId).toBe("e1");
    expect(p.sampled.length).toBe(16 * 2);

    // First sample = source center (5, 5), last = target center (105, 105).
    expect(p.sampled[0]).toBeCloseTo(5, 5);
    expect(p.sampled[1]).toBeCloseTo(5, 5);
    expect(p.sampled[p.sampled.length - 2]).toBeCloseTo(105, 5);
    expect(p.sampled[p.sampled.length - 1]).toBeCloseTo(105, 5);
  });

  it("tension=0 collapses the spline toward the straight chord", () => {
    const files = [f("src/a/x.ts"), f("src/b/y.ts")];
    const tree = buildFolderTree(files);
    const rects = new Map<string, Rect>([
      ["src/a/x.ts", { x: 0, y: 0, w: 10, h: 10 }],    // center 5,5
      ["src/b/y.ts", { x: 100, y: 100, w: 10, h: 10 }], // center 105,105
    ]);
    fillFolderCenters(tree, rects);

    const paths = computeHEBPaths([e("e1", "src/a/x.ts", "src/b/y.ts")], rects, tree, {
      tension: 0,
      samples: 16,
    });
    const p = paths[0]!;
    // With tension=0, middle control points are pinned to the chord, so
    // every sample lies on the line from (5,5) → (105,105). We check that
    // a mid sample is near the line's midpoint.
    const midX = p.sampled[16]!; // sample 8's x
    const midY = p.sampled[17]!;
    expect(midX).toBeGreaterThan(0);
    expect(midX).toBeLessThan(110);
    // On the chord line y = x.
    expect(Math.abs(midY - midX)).toBeLessThan(1);
  });

  it("sampleBspline returns an empty array for degenerate input", () => {
    expect(sampleBspline(new Float32Array([]), 10).length).toBe(0);
    expect(sampleBspline(new Float32Array([1, 2]), 10).length).toBe(0);
  });

  it("skips edges whose endpoints are missing from fileRects", () => {
    const files = [f("a.ts"), f("b.ts")];
    const tree = buildFolderTree(files);
    const rects = new Map<string, Rect>([
      ["a.ts", { x: 0, y: 0, w: 10, h: 10 }],
      // b.ts intentionally missing
    ]);
    fillFolderCenters(tree, rects);
    const paths = computeHEBPaths([e("e1", "a.ts", "b.ts")], rects, tree);
    expect(paths.length).toBe(0);
  });
});
