import { describe, it, expect } from "vitest";
import { computeBlastCone, computeFixCone } from "./blast-fix-cone";
import type { FileEdge } from "./types";

function makeEdge(from: string, to: string, weight: number = 1): FileEdge {
  return { id: `${from}->${to}`, from, to, kind: "import", layer: "structural", weight };
}

describe("computeBlastCone / computeFixCone", () => {
  it("returns empty rings for a node with no outgoing edges (blast)", () => {
    const graph = { fileEdges: [makeEdge("a", "b")] };
    const cone = computeBlastCone(graph, "b");
    expect(cone.rings).toEqual([]);
    expect(cone.totalAffected).toBe(0);
    expect(cone.rootFileId).toBe("b");
    expect(cone.direction).toBe("blast");
  });

  it("returns empty rings for a node with no incoming edges (fix)", () => {
    const graph = { fileEdges: [makeEdge("a", "b")] };
    const cone = computeFixCone(graph, "a");
    expect(cone.rings).toEqual([]);
    expect(cone.totalAffected).toBe(0);
  });

  it("BFS reaches files at exact depths and excludes root from rings", () => {
    //  root → a → b → c → d
    const edges: FileEdge[] = [
      makeEdge("root", "a"),
      makeEdge("a", "b"),
      makeEdge("b", "c"),
      makeEdge("c", "d"),
    ];
    const cone = computeBlastCone({ fileEdges: edges }, "root");
    expect(cone.rings.map(r => r.depth)).toEqual([1, 2, 3, 4]);
    expect(cone.rings[0].fileIds).toEqual(["a"]);
    expect(cone.rings[3].fileIds).toEqual(["d"]);
    expect(cone.totalAffected).toBe(4);
  });

  it("respects maxDepth", () => {
    const edges: FileEdge[] = [
      makeEdge("root", "a"),
      makeEdge("a", "b"),
      makeEdge("b", "c"),
    ];
    const cone = computeBlastCone({ fileEdges: edges }, "root", 2);
    expect(cone.rings).toHaveLength(2);
    expect(cone.rings[1].fileIds).toEqual(["b"]);
    expect(cone.totalAffected).toBe(2);
  });

  it("sums ring totalWeight across crossing edges", () => {
    // root → a (w=2), root → b (w=3). Both live in ring 1.
    const edges: FileEdge[] = [
      makeEdge("root", "a", 2),
      makeEdge("root", "b", 3),
    ];
    const cone = computeBlastCone({ fileEdges: edges }, "root");
    expect(cone.rings).toHaveLength(1);
    expect(cone.rings[0].totalWeight).toBe(5);
    expect(cone.rings[0].fileIds).toEqual(["a", "b"]);
  });

  it("blast vs fix are symmetric on reversed edges", () => {
    //  a → b → c
    const edges: FileEdge[] = [makeEdge("a", "b"), makeEdge("b", "c")];
    const blast = computeBlastCone({ fileEdges: edges }, "a");
    const fix = computeFixCone({ fileEdges: edges }, "c");
    expect(blast.totalAffected).toBe(2);
    expect(fix.totalAffected).toBe(2);
    expect(blast.rings.map(r => r.fileIds)).toEqual([["b"], ["c"]]);
    expect(fix.rings.map(r => r.fileIds)).toEqual([["b"], ["a"]]);
  });

  it("does not revisit nodes already reached at a shorter depth", () => {
    // diamond: root → a, root → b, a → c, b → c. c should appear only in ring 2 once.
    const edges: FileEdge[] = [
      makeEdge("root", "a"),
      makeEdge("root", "b"),
      makeEdge("a", "c"),
      makeEdge("b", "c"),
    ];
    const cone = computeBlastCone({ fileEdges: edges }, "root");
    expect(cone.rings).toHaveLength(2);
    expect(cone.rings[0].fileIds).toEqual(["a", "b"]);
    expect(cone.rings[1].fileIds).toEqual(["c"]);
    expect(cone.totalAffected).toBe(3);
  });

  it("sorts fileIds within a ring ascending for determinism", () => {
    const edges: FileEdge[] = [
      makeEdge("root", "zeta"),
      makeEdge("root", "alpha"),
      makeEdge("root", "mid"),
    ];
    const cone = computeBlastCone({ fileEdges: edges }, "root");
    expect(cone.rings[0].fileIds).toEqual(["alpha", "mid", "zeta"]);
  });
});
