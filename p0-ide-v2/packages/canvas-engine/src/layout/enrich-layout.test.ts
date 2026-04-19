import { describe, it, expect } from "vitest";
import { enrichLayout } from "./enrich-layout";
import type { WorkspaceGraph, FileNode } from "../graph/types";

function makeFile(id: string): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "unknown",
    riskScore: 0,
    loc: 30,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 1 },
    functions: [],
  };
}

function makeGraph(): WorkspaceGraph {
  return {
    files: [makeFile("a.ts"), makeFile("b.ts"), makeFile("c.ts")],
    fileEdges: [
      { id: "e1", from: "a.ts", to: "b.ts", kind: "call", layer: "structural", weight: 1 },
      { id: "e2", from: "b.ts", to: "c.ts", kind: "import", layer: "structural", weight: 1 },
    ],
    comments: [],
  };
}

describe("enrichLayout", () => {
  it("attaches metrics and sccs to a basic graph by default", () => {
    const result = enrichLayout(makeGraph());
    expect(result.metrics).toBeDefined();
    expect(result.metrics!.perFile.size).toBe(3);
    expect(result.sccs).toBeDefined();
    expect(result.startHere).toBeDefined();
  });

  it("is idempotent: two calls on the same graph produce structurally equal output", () => {
    const graph = makeGraph();
    const a = enrichLayout(graph);
    const b = enrichLayout(graph);
    expect(a.metrics?.perFile.size).toBe(b.metrics?.perFile.size);
    expect(a.sccs?.length).toBe(b.sccs?.length);
    expect(a.startHere?.length).toBe(b.startHere?.length);
  });

  it("omits all optional sections when every flag is disabled", () => {
    const result = enrichLayout(makeGraph(), {
      computeMetrics: false,
      computeSccs: false,
      computeStartHere: false,
      computeArchViolations: false,
    });
    expect(result.metrics).toBeUndefined();
    expect(result.sccs).toBeUndefined();
    expect(result.startHere).toBeUndefined();
    expect(result.archViolations).toBeUndefined();
  });

  it("does not throw on empty graph input", () => {
    const empty: WorkspaceGraph = { files: [], fileEdges: [], comments: [] };
    expect(() => enrichLayout(empty)).not.toThrow();
    const result = enrichLayout(empty);
    expect(result.metrics?.perFile.size ?? 0).toBe(0);
  });

  it("startHere is undefined when metrics are disabled (guarded by metrics presence)", () => {
    const result = enrichLayout(makeGraph(), { computeMetrics: false });
    expect(result.startHere).toBeUndefined();
  });
});
