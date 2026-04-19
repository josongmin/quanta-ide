import { describe, it, expect } from "vitest";
import type { FileEdge, FileNode, WorkspaceGraph } from "../graph/types";
import { buildEntityTree } from "../entity/build-entity-tree";
import { rollupEdges } from "./edge-rollup";

function makeFile(id: string): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "domain",
    riskScore: 0,
    loc: 1,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
  };
}

function makeEdge(id: string, from: string, to: string, weight = 1): FileEdge {
  return { id, from, to, kind: "import", layer: "structural", weight };
}

describe("rollupEdges", () => {
  it("collapses file edges into street-level aggregates", () => {
    const graph: WorkspaceGraph = {
      files: [
        makeFile("pkg/a/one.ts"),
        makeFile("pkg/a/two.ts"),
        makeFile("pkg/b/three.ts"),
      ],
      fileEdges: [
        makeEdge("e1", "pkg/a/one.ts", "pkg/b/three.ts"),
        makeEdge("e2", "pkg/a/two.ts", "pkg/b/three.ts"),
      ],
      comments: [],
    };
    const tree = buildEntityTree(graph);
    const rolled = rollupEdges(tree, graph.fileEdges, "street");
    expect(rolled).toHaveLength(1);
    expect(rolled[0]?.count).toBe(2);
    expect(rolled[0]?.memberEdgeIds).toEqual(["e1", "e2"]);
    expect(rolled[0]?.weight).toBe(2);
  });

  it("drops self-loops at coarse tiers", () => {
    const graph: WorkspaceGraph = {
      files: [makeFile("pkg/a/one.ts"), makeFile("pkg/a/two.ts")],
      fileEdges: [makeEdge("e1", "pkg/a/one.ts", "pkg/a/two.ts")],
      comments: [],
    };
    const tree = buildEntityTree(graph);
    // At galaxy tier (package), both files live under the same galaxy
    // → edge collapses to self-loop, which we drop.
    const rolled = rollupEdges(tree, graph.fileEdges, "galaxy");
    expect(rolled).toHaveLength(0);
  });

  it("sums weights across multiple underlying edges", () => {
    const graph: WorkspaceGraph = {
      files: [makeFile("a/x.ts"), makeFile("b/y.ts")],
      fileEdges: [
        makeEdge("e1", "a/x.ts", "b/y.ts", 3),
        makeEdge("e2", "a/x.ts", "b/y.ts", 7),
      ],
      comments: [],
    };
    const tree = buildEntityTree(graph);
    const rolled = rollupEdges(tree, graph.fileEdges, "galaxy");
    expect(rolled).toHaveLength(1);
    expect(rolled[0]?.weight).toBe(10);
    expect(rolled[0]?.count).toBe(2);
  });

  it("returns empty array when target kind is absent from the tree", () => {
    const graph: WorkspaceGraph = {
      // Files without `functions` stop at building; floor/room never emit.
      files: [makeFile("a/x.ts"), makeFile("b/y.ts")],
      fileEdges: [makeEdge("e1", "a/x.ts", "b/y.ts")],
      comments: [],
    };
    const tree = buildEntityTree(graph);
    expect(rollupEdges(tree, graph.fileEdges, "floor")).toHaveLength(0);
    expect(rollupEdges(tree, graph.fileEdges, "room")).toHaveLength(0);
  });
});
