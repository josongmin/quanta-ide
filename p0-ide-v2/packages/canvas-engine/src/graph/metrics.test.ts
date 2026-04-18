import { describe, it, expect } from "vitest";
import { computeWorkspaceMetrics } from "./metrics";
import type { FileEdge, FileNode } from "./types";

function makeFile(id: string): FileNode {
  return {
    id,
    name: id,
    layer: "unknown",
    riskScore: 0,
    loc: 0,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
  };
}

function makeEdge(from: string, to: string): FileEdge {
  return {
    id: `${from}->${to}`,
    from,
    to,
    kind: "import",
    layer: "structural",
    weight: 1,
  };
}

// Chain A - B - C - D with an extra D → B edge.
//
//   A ── B ── C ── D
//        ^─────────┘
const chainFiles: FileNode[] = ["A", "B", "C", "D"].map(makeFile);
const chainEdges: FileEdge[] = [
  makeEdge("A", "B"),
  makeEdge("B", "C"),
  makeEdge("C", "D"),
  makeEdge("D", "B"),
];
const chainGraph = { files: chainFiles, fileEdges: chainEdges };

describe("computeWorkspaceMetrics — degree", () => {
  it("counts in/out/total degree correctly", () => {
    const m = computeWorkspaceMetrics(chainGraph);
    // A: out=1 (A→B), in=0
    expect(m.perFile.get("A")).toMatchObject({ inDegree: 0, outDegree: 1, degree: 1 });
    // B: in=2 (A→B, D→B), out=1 (B→C)
    expect(m.perFile.get("B")).toMatchObject({ inDegree: 2, outDegree: 1, degree: 3 });
    // C: in=1 (B→C), out=1 (C→D)
    expect(m.perFile.get("C")).toMatchObject({ inDegree: 1, outDegree: 1, degree: 2 });
    // D: in=1 (C→D), out=1 (D→B)
    expect(m.perFile.get("D")).toMatchObject({ inDegree: 1, outDegree: 1, degree: 2 });
  });

  it("returns topByDegree sorted descending with stable id tie-break", () => {
    const m = computeWorkspaceMetrics(chainGraph);
    // B=3, C=2, D=2, A=1 → C before D by id.
    expect(m.topByDegree).toEqual(["B", "C", "D", "A"]);
  });

  it("reports file and edge counts alongside compute time", () => {
    const m = computeWorkspaceMetrics(chainGraph);
    expect(m.fileCount).toBe(4);
    expect(m.edgeCount).toBe(4);
    expect(m.computeMs).toBeGreaterThanOrEqual(0);
    expect(m.betweennessSampled).toBe(false);
  });

  it("handles empty graphs without crashing", () => {
    const m = computeWorkspaceMetrics({ files: [], fileEdges: [] });
    expect(m.perFile.size).toBe(0);
    expect(m.topByDegree).toEqual([]);
    expect(m.topByBetweenness).toEqual([]);
  });
});

describe("computeWorkspaceMetrics — betweenness", () => {
  it("ranks mid-chain B as most central on A-B-C-D chain", () => {
    // Pure chain without the D→B back-edge so the classic result applies:
    // B and C should dominate because every shortest path between extreme
    // endpoints goes through them. With the D→B cycle we still expect B
    // to win because it participates in more shortest paths than C due to
    // the extra entry from D.
    const files: FileNode[] = ["A", "B", "C", "D"].map(makeFile);
    const edges: FileEdge[] = [
      makeEdge("A", "B"),
      makeEdge("B", "C"),
      makeEdge("C", "D"),
      makeEdge("D", "B"),
    ];
    const m = computeWorkspaceMetrics({ files, fileEdges: edges }, {
      computeBetweenness: true,
    });
    expect(m.topByBetweenness.length).toBeGreaterThan(0);
    expect(m.topByBetweenness[0]).toBe("B");
    // End nodes A must have betweenness 0 (nothing passes through them).
    expect(m.perFile.get("A")?.betweennessRank).toBe(0);
  });

  it("marks betweennessSampled=false when below threshold", () => {
    const m = computeWorkspaceMetrics(chainGraph, { computeBetweenness: true });
    expect(m.betweennessSampled).toBe(false);
  });

  it("uses sampling for large graphs", () => {
    // Build a star — many leaves around a single hub. Betweenness ranks
    // the hub #1 under both exact and sampled modes, so we can use this
    // shape to verify the sampled path still returns a sensible ranking.
    const N = 50;
    const files: FileNode[] = [];
    files.push(makeFile("hub"));
    for (let i = 0; i < N; i++) files.push(makeFile(`leaf-${i}`));
    const edges: FileEdge[] = [];
    for (let i = 0; i < N; i++) edges.push(makeEdge("hub", `leaf-${i}`));

    const m = computeWorkspaceMetrics({ files, fileEdges: edges }, {
      computeBetweenness: true,
      // Force sampling by setting a tiny threshold.
      exactBetweennessThreshold: 10,
      sampleSize: 8,
    });
    expect(m.betweennessSampled).toBe(true);
    expect(m.topByBetweenness[0]).toBe("hub");
  });
});
