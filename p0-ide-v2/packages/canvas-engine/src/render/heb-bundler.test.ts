import { describe, it, expect } from "vitest";
import type { FileEdge, FileNode, Rect } from "../graph/types";
import { buildFolderTree, fillFolderCenters } from "../graph/folder-tree";
import {
  computeHEBPaths,
  computeHEBPathsAsync,
  isHebAbort,
  sampleBspline,
} from "./heb-bundler";

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

  describe("computeHEBPathsAsync (chunked + abortable)", () => {
    // Build a synthetic graph big enough that the chunked compute crosses
    // multiple yield boundaries. 600 edges × 128 chunk size = 4-5 yields,
    // plenty of abort opportunities.
    function makeLargeGraph() {
      const files: FileNode[] = [];
      for (let i = 0; i < 60; i++) {
        // Spread across a few folders so the LCA logic runs on real data
        // and we exercise the full per-edge body at each yield point.
        const folder = i % 6;
        files.push(f(`src/pkg${folder}/file${i}.ts`));
      }
      const rects = new Map<string, Rect>();
      for (let i = 0; i < files.length; i++) {
        rects.set(files[i]!.id, {
          x: (i % 10) * 20,
          y: Math.floor(i / 10) * 20,
          w: 10,
          h: 10,
        });
      }
      const tree = buildFolderTree(files);
      fillFolderCenters(tree, rects);

      // 600 edges, each connecting two pseudo-random files.
      const edges: FileEdge[] = [];
      for (let i = 0; i < 600; i++) {
        const a = files[i % files.length]!.id;
        const b = files[(i * 7 + 3) % files.length]!.id;
        if (a !== b) edges.push(e(`edge${i}`, a, b));
      }
      return { edges, rects, tree };
    }

    it("matches the sync variant edge-for-edge when not aborted", async () => {
      const { edges, rects, tree } = makeLargeGraph();
      const sync = computeHEBPaths(edges, rects, tree, { samples: 16 });
      const async_ = await computeHEBPathsAsync(edges, rects, tree, {
        samples: 16,
        chunkSize: 64,
      });
      expect(async_.length).toBe(sync.length);
      for (let i = 0; i < sync.length; i++) {
        expect(async_[i]!.edgeId).toBe(sync[i]!.edgeId);
        expect(async_[i]!.sampled.length).toBe(sync[i]!.sampled.length);
      }
    });

    it("throws HebAbortError early when signal is aborted before starting", async () => {
      const { edges, rects, tree } = makeLargeGraph();
      const controller = new AbortController();
      controller.abort();
      await expect(
        computeHEBPathsAsync(edges, rects, tree, {
          signal: controller.signal,
          chunkSize: 64,
        }),
      ).rejects.toSatisfy(isHebAbort);
    });

    it("aborts mid-compute and does NOT process all edges", async () => {
      const { edges, rects, tree } = makeLargeGraph();
      expect(edges.length).toBeGreaterThanOrEqual(500);

      const controller = new AbortController();
      // Fire the abort on the very first macrotask after starting — the
      // compute will have processed at most `chunkSize` edges by then.
      const chunkSize = 64;
      const promise = computeHEBPathsAsync(edges, rects, tree, {
        signal: controller.signal,
        chunkSize,
        samples: 16,
      });
      // Queue the abort as the next macrotask so it lands while the first
      // chunk is still executing or at the very first yield.
      setTimeout(() => controller.abort(), 0);

      await expect(promise).rejects.toSatisfy(isHebAbort);
    });

    it("returns full result when abort fires after compute completes", async () => {
      // Tiny graph — completes in a single chunk, no yield, so a late
      // abort is a no-op and we get the full result.
      const files = [f("src/a/x.ts"), f("src/b/y.ts")];
      const tree = buildFolderTree(files);
      const rects = new Map<string, Rect>([
        ["src/a/x.ts", { x: 0, y: 0, w: 10, h: 10 }],
        ["src/b/y.ts", { x: 100, y: 100, w: 10, h: 10 }],
      ]);
      fillFolderCenters(tree, rects);
      const controller = new AbortController();
      const paths = await computeHEBPathsAsync(
        [e("e1", "src/a/x.ts", "src/b/y.ts")],
        rects,
        tree,
        { signal: controller.signal, chunkSize: 64 },
      );
      controller.abort(); // too late — compute already resolved
      expect(paths.length).toBe(1);
    });
  });
});
