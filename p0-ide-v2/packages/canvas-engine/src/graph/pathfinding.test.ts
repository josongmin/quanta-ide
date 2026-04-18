import { describe, expect, it } from "vitest";
import { findPaths } from "./pathfinding";
import type { EdgeKind, EdgeLayer, FileEdge } from "./types";

function makeEdge(
  from: string,
  to: string,
  kind: EdgeKind = "import",
  layer: EdgeLayer = "structural",
  weight = 1,
): FileEdge {
  return { id: `${from}->${to}`, from, to, kind, layer, weight };
}

describe("findPaths", () => {
  it("shortest on a line graph A-B-C-D returns [A,B,C,D]", () => {
    const edges: FileEdge[] = [
      makeEdge("A", "B"),
      makeEdge("B", "C"),
      makeEdge("C", "D"),
    ];
    const r = findPaths({ fileEdges: edges }, {
      sourceFileId: "A",
      targetFileId: "D",
      mode: "shortest",
    });
    expect(r.truncated).toBe(false);
    expect(r.paths).toHaveLength(1);
    expect(r.paths[0]!.nodeIds).toEqual(["A", "B", "C", "D"]);
    expect(r.paths[0]!.cost).toBe(3);
    expect(r.paths[0]!.edgeIds).toEqual(["A->B", "B->C", "C->D"]);
  });

  it("all-shortest on a diamond returns both 2-hop routes", () => {
    const edges: FileEdge[] = [
      makeEdge("A", "B"),
      makeEdge("B", "D"),
      makeEdge("A", "C"),
      makeEdge("C", "D"),
    ];
    const r = findPaths({ fileEdges: edges }, {
      sourceFileId: "A",
      targetFileId: "D",
      mode: "all-shortest",
    });
    expect(r.truncated).toBe(false);
    expect(r.paths).toHaveLength(2);
    const nodeSeqs = r.paths.map(p => p.nodeIds.join(","));
    expect(nodeSeqs.sort()).toEqual(["A,B,D", "A,C,D"]);
    for (const p of r.paths) expect(p.cost).toBe(2);
  });

  it("layer filter that excludes the only connecting layer returns no paths (reachable but filtered out)", () => {
    const edges: FileEdge[] = [
      makeEdge("A", "B", "import", "structural"),
      makeEdge("B", "C", "import", "structural"),
    ];
    const r = findPaths({ fileEdges: edges }, {
      sourceFileId: "A",
      targetFileId: "C",
      mode: "shortest",
      layerFilter: new Set<EdgeLayer>(["safety"]),
    });
    expect(r.paths).toHaveLength(0);
  });

  it("maxDepth truncation is flagged when target is beyond the cap", () => {
    const edges: FileEdge[] = [
      makeEdge("A", "B"),
      makeEdge("B", "C"),
      makeEdge("C", "D"),
      makeEdge("D", "E"),
    ];
    const r = findPaths({ fileEdges: edges }, {
      sourceFileId: "A",
      targetFileId: "E",
      mode: "shortest",
      maxDepth: 2,
    });
    expect(r.paths).toHaveLength(0);
    expect(r.truncated).toBe(true);
  });

  it("k-shortest=2 on a graph with 2 distinct routes returns both", () => {
    // Two parallel routes of differing length: A-B-D (2 hops), A-C-E-D (3 hops).
    const edges: FileEdge[] = [
      makeEdge("A", "B"),
      makeEdge("B", "D"),
      makeEdge("A", "C"),
      makeEdge("C", "E"),
      makeEdge("E", "D"),
    ];
    const r = findPaths({ fileEdges: edges }, {
      sourceFileId: "A",
      targetFileId: "D",
      mode: "k-shortest",
      k: 2,
    });
    expect(r.paths.length).toBeGreaterThanOrEqual(2);
    expect(r.paths[0]!.cost).toBe(2);
    expect(r.paths[1]!.cost).toBe(3);
    const seqs = r.paths.slice(0, 2).map(p => p.nodeIds.join(","));
    expect(seqs).toContain("A,B,D");
    expect(seqs).toContain("A,C,E,D");
  });

  it("directional=true respects edge direction (reverse unreachable)", () => {
    const edges: FileEdge[] = [
      makeEdge("A", "B"),
      makeEdge("B", "C"),
    ];
    const forward = findPaths({ fileEdges: edges }, {
      sourceFileId: "A",
      targetFileId: "C",
      mode: "shortest",
      directional: true,
    });
    expect(forward.paths).toHaveLength(1);

    const reverse = findPaths({ fileEdges: edges }, {
      sourceFileId: "C",
      targetFileId: "A",
      mode: "shortest",
      directional: true,
    });
    expect(reverse.paths).toHaveLength(0);
  });

  it("source == target is a zero-cost no-op path", () => {
    const edges: FileEdge[] = [makeEdge("A", "B")];
    const r = findPaths({ fileEdges: edges }, {
      sourceFileId: "A",
      targetFileId: "A",
      mode: "shortest",
    });
    expect(r.paths).toHaveLength(1);
    expect(r.paths[0]!.nodeIds).toEqual(["A"]);
    expect(r.paths[0]!.edgeIds).toEqual([]);
    expect(r.paths[0]!.cost).toBe(0);
  });
});
