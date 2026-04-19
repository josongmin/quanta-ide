import { describe, it, expect } from "vitest";
import { computeNeighborhood } from "./neighborhood";
import type { FileEdge } from "./types";

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

// Graph shape:
//   A - B - C
//   A - D
//   E (isolated)
const edges: FileEdge[] = [
  makeEdge("A", "B"),
  makeEdge("B", "C"),
  makeEdge("A", "D"),
];
const graph = { fileEdges: edges };

describe("computeNeighborhood", () => {
  it("maxHops=0 reaches only the center with no edges", () => {
    const n = computeNeighborhood(graph, "A", 0);
    expect(n.center).toBe("A");
    expect([...n.hop.entries()]).toEqual([["A", 0]]);
    expect(n.edges.size).toBe(0);
  });

  it("maxHops=1 reaches direct neighbors (undirected) with their edges", () => {
    const n = computeNeighborhood(graph, "A", 1);
    expect(n.hop.get("A")).toBe(0);
    expect(n.hop.get("B")).toBe(1);
    expect(n.hop.get("D")).toBe(1);
    expect(n.hop.has("C")).toBe(false);
    // Edges where BOTH endpoints are in the reached set: A-B, A-D
    expect([...n.edges].sort()).toEqual(["A->B", "A->D"]);
  });

  it("maxHops=2 reaches 2-hop neighbors with all spanning edges", () => {
    const n = computeNeighborhood(graph, "A", 2);
    expect(n.hop.get("A")).toBe(0);
    expect(n.hop.get("B")).toBe(1);
    expect(n.hop.get("D")).toBe(1);
    expect(n.hop.get("C")).toBe(2);
    expect([...n.edges].sort()).toEqual(["A->B", "A->D", "B->C"]);
  });

  it("isolated center yields no neighbors at any depth", () => {
    const n = computeNeighborhood(graph, "E", 2);
    expect([...n.hop.entries()]).toEqual([["E", 0]]);
    expect(n.edges.size).toBe(0);
  });
});
