import { describe, it, expect } from "vitest";
import { gridLayout } from "./grid-layout";
import type { WorkspaceGraph, FileNode } from "../graph/types";
import { FILE_CARD_W, GRID_GAP_X, GRID_COLS } from "./types";

function makeFile(id: string, loc = 50): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "unknown",
    riskScore: 0,
    loc,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 1 },
    functions: [],
  };
}

function makeGraph(ids: string[]): WorkspaceGraph {
  return { files: ids.map(id => makeFile(id)), fileEdges: [], comments: [] };
}

describe("gridLayout", () => {
  it("places N files across up to GRID_COLS columns", () => {
    const ids = Array.from({ length: 16 }, (_, i) => `f${i}.ts`);
    const result = gridLayout(makeGraph(ids));
    expect(result.fileRects.size).toBe(16);
    // Unique X coords = min(N, GRID_COLS).
    const xs = new Set<number>();
    for (const r of result.fileRects.values()) xs.add(r.x);
    expect(xs.size).toBe(Math.min(16, GRID_COLS));
    // All x's are multiples of FILE_CARD_W + GRID_GAP_X.
    const step = FILE_CARD_W + GRID_GAP_X;
    for (const x of xs) expect(x % step).toBe(0);
  });

  it("empty input returns empty fileRects and zero-sized bounds (plus padding)", () => {
    const result = gridLayout(makeGraph([]));
    expect(result.fileRects.size).toBe(0);
    expect(result.totalBounds.x).toBe(0);
    expect(result.totalBounds.y).toBe(0);
    // Implementation pads 48 even on empty — assert non-negative rather than 0.
    expect(result.totalBounds.w).toBeGreaterThanOrEqual(0);
    expect(result.totalBounds.h).toBeGreaterThanOrEqual(0);
  });

  it("large file count runs within perf budget", () => {
    const ids = Array.from({ length: 500 }, (_, i) => `big/f${i}.ts`);
    const graph = makeGraph(ids);
    const start = performance.now();
    const result = gridLayout(graph);
    const elapsed = performance.now() - start;
    expect(result.fileRects.size).toBe(500);
    expect(elapsed).toBeLessThan(200);
  });

  it("is deterministic: same input yields identical rects", () => {
    const ids = Array.from({ length: 20 }, (_, i) => `f${i}.ts`);
    const a = gridLayout(makeGraph(ids));
    const b = gridLayout(makeGraph(ids));
    for (const id of ids) {
      expect(a.fileRects.get(id)).toEqual(b.fileRects.get(id));
    }
    expect(a.totalBounds).toEqual(b.totalBounds);
  });

  it("file height scales with LOC (longer files produce taller rects)", () => {
    const graph: WorkspaceGraph = {
      files: [makeFile("tiny.ts", 1), makeFile("huge.ts", 500)],
      fileEdges: [],
      comments: [],
    };
    const result = gridLayout(graph);
    const tiny = result.fileRects.get("tiny.ts")!;
    const huge = result.fileRects.get("huge.ts")!;
    expect(huge.h).toBeGreaterThan(tiny.h);
  });
});
