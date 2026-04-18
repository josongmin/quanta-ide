import { describe, it, expect } from "vitest";
import { computeDebtStrata } from "./debt-strata";
import type { FileNode, WorkspaceGraph } from "./types";
import type { FileBlame } from "./blame";

function makeFile(id: string, opts: Partial<FileNode> = {}): FileNode {
  return {
    id,
    name: id,
    layer: "unknown",
    riskScore: 0,
    loc: 0,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
    ...opts,
  };
}

const MS_PER_MONTH = 1000 * 86_400 * 30.44;

describe("computeDebtStrata", () => {
  it("returns empty map when no blame is present", () => {
    const graph: WorkspaceGraph = {
      files: [makeFile("a.ts", { loc: 10 })],
      fileEdges: [],
      comments: [],
    };
    const r = computeDebtStrata(graph);
    expect(r.perFile.size).toBe(0);
    expect(r.globalMaxDebt).toBe(0);
  });

  it("skips files with zero blame entries", () => {
    const graph: WorkspaceGraph = {
      files: [makeFile("a.ts", { loc: 10 })],
      fileEdges: [],
      comments: [],
      blame: {
        "a.ts": { fileId: "a.ts", lineCount: 10, entries: [] },
      },
    };
    const r = computeDebtStrata(graph);
    expect(r.perFile.has("a.ts")).toBe(false);
  });

  it("buckets lines by age and sorts layers ascending", () => {
    const now = 10_000_000_000_000;
    const blame: Record<string, FileBlame> = {
      "f.ts": {
        fileId: "f.ts",
        lineCount: 100,
        entries: [
          { startLine: 1, endLine: 20, committedAt: now - 1 * MS_PER_MONTH, author: "a" },
          { startLine: 21, endLine: 40, committedAt: now - 5 * MS_PER_MONTH, author: "b" },
          { startLine: 41, endLine: 70, committedAt: now - 10 * MS_PER_MONTH, author: "c" },
          { startLine: 71, endLine: 100, committedAt: now - 36 * MS_PER_MONTH, author: "d" },
        ],
      },
    };
    const graph: WorkspaceGraph = {
      files: [makeFile("f.ts", { loc: 100 })],
      fileEdges: [],
      comments: [],
      blame,
    };
    const r = computeDebtStrata(graph, now);
    const layers = r.perFile.get("f.ts")!;
    expect(layers.map(l => l.ageBucketMonths)).toEqual([3, 6, 12, Infinity]);
    expect(layers[0].lineCount).toBe(20);
    expect(layers[3].lineCount).toBe(30);
    // Older buckets carry heavier age weight: the ∞ bucket should exceed the 3m bucket.
    expect(layers[3].accumulatedDebt).toBeGreaterThan(layers[0].accumulatedDebt);
  });

  it("boosts accumulatedDebt with author diversity", () => {
    const now = 10_000_000_000_000;
    const soloAuthor: FileBlame = {
      fileId: "solo.ts",
      lineCount: 40,
      entries: [
        { startLine: 1, endLine: 40, committedAt: now - 1 * MS_PER_MONTH, author: "a" },
      ],
    };
    const mixedAuthors: FileBlame = {
      fileId: "mixed.ts",
      lineCount: 40,
      entries: [
        { startLine: 1, endLine: 10, committedAt: now - 1 * MS_PER_MONTH, author: "a" },
        { startLine: 11, endLine: 20, committedAt: now - 1 * MS_PER_MONTH, author: "b" },
        { startLine: 21, endLine: 30, committedAt: now - 1 * MS_PER_MONTH, author: "c" },
        { startLine: 31, endLine: 40, committedAt: now - 1 * MS_PER_MONTH, author: "d" },
      ],
    };
    const graph: WorkspaceGraph = {
      files: [makeFile("solo.ts", { loc: 40 }), makeFile("mixed.ts", { loc: 40 })],
      fileEdges: [],
      comments: [],
      blame: { "solo.ts": soloAuthor, "mixed.ts": mixedAuthors },
    };
    const r = computeDebtStrata(graph, now);
    const solo = r.perFile.get("solo.ts")![0];
    const mixed = r.perFile.get("mixed.ts")![0];
    expect(mixed.accumulatedDebt).toBeGreaterThan(solo.accumulatedDebt);
  });

  it("tracks globalMaxDebt across files", () => {
    const now = 10_000_000_000_000;
    const blame: Record<string, FileBlame> = {
      "hi.ts": {
        fileId: "hi.ts",
        lineCount: 100,
        entries: [
          { startLine: 1, endLine: 100, committedAt: now - 40 * MS_PER_MONTH, author: "a" },
          { startLine: 1, endLine: 25, committedAt: now - 40 * MS_PER_MONTH, author: "b" },
          { startLine: 26, endLine: 50, committedAt: now - 40 * MS_PER_MONTH, author: "c" },
          { startLine: 51, endLine: 75, committedAt: now - 40 * MS_PER_MONTH, author: "d" },
        ],
      },
      "lo.ts": {
        fileId: "lo.ts",
        lineCount: 100,
        entries: [
          { startLine: 1, endLine: 5, committedAt: now - 1 * MS_PER_MONTH, author: "a" },
        ],
      },
    };
    const graph: WorkspaceGraph = {
      files: [makeFile("hi.ts", { loc: 100 }), makeFile("lo.ts", { loc: 100 })],
      fileEdges: [],
      comments: [],
      blame,
    };
    const r = computeDebtStrata(graph, now);
    const hiMax = Math.max(...r.perFile.get("hi.ts")!.map(l => l.accumulatedDebt));
    expect(r.globalMaxDebt).toBe(hiMax);
  });

  it("clamps accumulatedDebt to 0..100", () => {
    const now = 10_000_000_000_000;
    // Massively redundant blame entries — total line sum > file lineCount.
    const entries = Array.from({ length: 10 }, (_, i) => ({
      startLine: 1,
      endLine: 100,
      committedAt: now - 40 * MS_PER_MONTH,
      author: `author-${i}`,
    }));
    const blame: Record<string, FileBlame> = {
      "f.ts": { fileId: "f.ts", lineCount: 100, entries },
    };
    const graph: WorkspaceGraph = {
      files: [makeFile("f.ts", { loc: 100 })],
      fileEdges: [],
      comments: [],
      blame,
    };
    const r = computeDebtStrata(graph, now);
    const layers = r.perFile.get("f.ts")!;
    for (const l of layers) {
      expect(l.accumulatedDebt).toBeGreaterThanOrEqual(0);
      expect(l.accumulatedDebt).toBeLessThanOrEqual(100);
    }
  });
});
