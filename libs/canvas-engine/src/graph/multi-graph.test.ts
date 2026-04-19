import { describe, it, expect } from "vitest";
import type { FileEdge, FileNode, WorkspaceGraph } from "./types";
import { joinGraphs, type JoinEdge, type NamedGraph } from "./multi-graph";

function makeFile(id: string): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "util",
    riskScore: 0.2,
    loc: 50,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 1 },
    functions: [],
  };
}

function makeEdge(from: string, to: string): FileEdge {
  return {
    id: `e:${from}->${to}`,
    from,
    to,
    kind: "import",
    layer: "structural",
    weight: 1,
  };
}

function makeGraph(ids: string[], edges: Array<[string, string]>): WorkspaceGraph {
  return {
    files: ids.map(makeFile),
    fileEdges: edges.map(([a, b]) => makeEdge(a, b)),
    comments: [],
  };
}

describe("joinGraphs", () => {
  it("merges two graphs of 3 files each + 2 join edges → 6 files + all edges", () => {
    const g1: NamedGraph = {
      graphId: "g1",
      label: "frontend",
      color: 0x3b82f6,
      graph: makeGraph(["a.ts", "b.ts", "c.ts"], [["a.ts", "b.ts"], ["b.ts", "c.ts"]]),
    };
    const g2: NamedGraph = {
      graphId: "g2",
      label: "api",
      color: 0xf59e0b,
      graph: makeGraph(["x.ts", "y.ts", "z.ts"], [["x.ts", "y.ts"], ["y.ts", "z.ts"]]),
    };
    const joins: JoinEdge[] = [
      { fromGraphId: "g1", fromFileId: "c.ts", toGraphId: "g2", toFileId: "x.ts", kind: "api-call" },
      { fromGraphId: "g1", fromFileId: "b.ts", toGraphId: "g2", toFileId: "y.ts", kind: "queue" },
    ];

    const merged = joinGraphs([g1, g2], joins);

    expect(merged.files).toHaveLength(6);
    expect(merged.fileEdges).toHaveLength(2 + 2 + 2);

    const crossGraphCount = merged.fileEdges.filter(e => e.crossGraph).length;
    expect(crossGraphCount).toBe(2);

    const innerCount = merged.fileEdges.filter(e => !e.crossGraph).length;
    expect(innerCount).toBe(4);
  });

  it("prefixes file IDs with `${graphId}::` to avoid collisions across graphs", () => {
    const g1: NamedGraph = {
      graphId: "g1",
      label: "frontend",
      color: 0x000000,
      graph: makeGraph(["app.ts"], []),
    };
    const g2: NamedGraph = {
      graphId: "g2",
      label: "api",
      color: 0x000000,
      graph: makeGraph(["app.ts"], []),
    };
    const merged = joinGraphs([g1, g2], []);
    const ids = merged.files.map(f => f.id).sort();
    expect(ids).toEqual(["g1::app.ts", "g2::app.ts"]);

    const g1File = merged.files.find(f => f.graphId === "g1");
    const g2File = merged.files.find(f => f.graphId === "g2");
    expect(g1File?.id).toBe("g1::app.ts");
    expect(g2File?.id).toBe("g2::app.ts");
  });

  it("sets crossGraph=true for edges that span graphs and false for intra-graph edges", () => {
    const g1: NamedGraph = {
      graphId: "g1",
      label: "a",
      color: 0,
      graph: makeGraph(["a.ts", "b.ts"], [["a.ts", "b.ts"]]),
    };
    const g2: NamedGraph = {
      graphId: "g2",
      label: "b",
      color: 0,
      graph: makeGraph(["x.ts"], []),
    };
    const joins: JoinEdge[] = [
      { fromGraphId: "g1", fromFileId: "a.ts", toGraphId: "g2", toFileId: "x.ts", kind: "rpc" },
    ];
    const merged = joinGraphs([g1, g2], joins);
    const intra = merged.fileEdges.find(e => e.from === "g1::a.ts" && e.to === "g1::b.ts");
    const cross = merged.fileEdges.find(e => e.from === "g1::a.ts" && e.to === "g2::x.ts");
    expect(intra?.crossGraph).toBe(false);
    expect(cross?.crossGraph).toBe(true);
    expect(cross?.kind).toBe("call");
  });

  it("maps join kinds to expected EdgeKinds", () => {
    const g: NamedGraph = {
      graphId: "g1", label: "", color: 0, graph: makeGraph(["a.ts"], []),
    };
    const g2: NamedGraph = {
      graphId: "g2", label: "", color: 0, graph: makeGraph(["b.ts"], []),
    };
    const joins: JoinEdge[] = [
      { fromGraphId: "g1", fromFileId: "a.ts", toGraphId: "g2", toFileId: "b.ts", kind: "api-call" },
      { fromGraphId: "g1", fromFileId: "a.ts", toGraphId: "g2", toFileId: "b.ts", kind: "queue" },
      { fromGraphId: "g1", fromFileId: "a.ts", toGraphId: "g2", toFileId: "b.ts", kind: "shared-db" },
      { fromGraphId: "g1", fromFileId: "a.ts", toGraphId: "g2", toFileId: "b.ts", kind: "rpc" },
    ];
    const merged = joinGraphs([g, g2], joins);
    const kinds = merged.fileEdges.filter(e => e.crossGraph).map(e => e.kind);
    expect(kinds).toEqual(["dependency", "impact", "reference", "call"]);
  });
});
