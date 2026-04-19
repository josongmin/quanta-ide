import { describe, it, expect } from "vitest";
import { findStronglyConnectedComponents } from "./scc";
import type { FileEdge, EdgeKind } from "./types";

function makeEdge(from: string, to: string, kind: EdgeKind = "import"): FileEdge {
  return {
    id: `${from}->${to}:${kind}`,
    from,
    to,
    kind,
    layer: "structural",
    weight: 1,
  };
}

describe("findStronglyConnectedComponents", () => {
  it("linear chain A→B→C has no cycles", () => {
    const edges: FileEdge[] = [makeEdge("A", "B"), makeEdge("B", "C")];
    const { components, componentOf } = findStronglyConnectedComponents({ fileEdges: edges });
    expect(components.length).toBe(0);
    expect(componentOf.size).toBe(0);
  });

  it("triangle A→B→C→A produces a single 3-member component", () => {
    const edges: FileEdge[] = [
      makeEdge("A", "B"),
      makeEdge("B", "C"),
      makeEdge("C", "A"),
    ];
    const { components, componentOf } = findStronglyConnectedComponents({ fileEdges: edges });
    expect(components.length).toBe(1);
    expect([...components[0]].sort()).toEqual(["A", "B", "C"]);
    expect(componentOf.get("A")).toBe(0);
    expect(componentOf.get("B")).toBe(0);
    expect(componentOf.get("C")).toBe(0);
  });

  it("two disjoint cycles + acyclic tail: 2 components, tail filtered", () => {
    // Cycle1: A→B→A; Cycle2: X→Y→Z→X; Tail: T1→T2
    const edges: FileEdge[] = [
      makeEdge("A", "B"),
      makeEdge("B", "A"),
      makeEdge("X", "Y"),
      makeEdge("Y", "Z"),
      makeEdge("Z", "X"),
      makeEdge("T1", "T2"),
    ];
    const { components, componentOf } = findStronglyConnectedComponents({ fileEdges: edges });
    expect(components.length).toBe(2);
    const sizes = components.map(c => c.length).sort();
    expect(sizes).toEqual([2, 3]);
    expect(componentOf.has("T1")).toBe(false);
    expect(componentOf.has("T2")).toBe(false);
    expect(componentOf.get("A")).toBe(componentOf.get("B"));
    expect(componentOf.get("X")).toBe(componentOf.get("Y"));
    expect(componentOf.get("X")).toBe(componentOf.get("Z"));
  });

  it("includeKinds filter changes result — dataflow cycle ignored by default", () => {
    // Same graph with a dataflow-only cycle. Default filter (import/call)
    // must report no cycles; overriding to include "dataflow" surfaces it.
    const edges: FileEdge[] = [
      makeEdge("A", "B", "dataflow"),
      makeEdge("B", "A", "dataflow"),
    ];
    const defaults = findStronglyConnectedComponents({ fileEdges: edges });
    expect(defaults.components.length).toBe(0);

    const widened = findStronglyConnectedComponents(
      { fileEdges: edges },
      { includeKinds: new Set(["dataflow"]) },
    );
    expect(widened.components.length).toBe(1);
    expect([...widened.components[0]].sort()).toEqual(["A", "B"]);
  });

  it("self-loop counts as a length-1 cycle", () => {
    const edges: FileEdge[] = [makeEdge("S", "S")];
    const { components, componentOf } = findStronglyConnectedComponents({ fileEdges: edges });
    expect(components.length).toBe(1);
    expect(components[0]).toEqual(["S"]);
    expect(componentOf.get("S")).toBe(0);
  });

  it("handles empty graph", () => {
    const { components, componentOf } = findStronglyConnectedComponents({ fileEdges: [] });
    expect(components).toEqual([]);
    expect(componentOf.size).toBe(0);
  });

  it("iterative DFS handles a deep linear cycle without stack overflow", () => {
    // 10k nodes in a single big cycle — recursion would blow the stack.
    const N = 10000;
    const edges: FileEdge[] = [];
    for (let i = 0; i < N; i++) {
      edges.push(makeEdge(`n${i}`, `n${(i + 1) % N}`));
    }
    const { components } = findStronglyConnectedComponents({ fileEdges: edges });
    expect(components.length).toBe(1);
    expect(components[0].length).toBe(N);
  });
});
