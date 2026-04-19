import { describe, it, expect } from "vitest";
import { detectArchViolations } from "./arch-violations";
import type {
  FileNode,
  FileEdge,
  ArchLayer,
  EdgeKind,
  EdgeLayer,
  WorkspaceGraph,
} from "./types";

function file(id: string, layer: ArchLayer): FileNode {
  return {
    id,
    name: id,
    layer,
    riskScore: 0,
    loc: 10,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
  };
}

function edge(
  id: string,
  from: string,
  to: string,
  kind: EdgeKind = "import",
  layer: EdgeLayer = "structural",
): FileEdge {
  return { id, from, to, kind, layer, weight: 1 };
}

function graph(files: FileNode[], fileEdges: FileEdge[]): Pick<WorkspaceGraph, "files" | "fileEdges"> {
  return { files, fileEdges };
}

describe("detectArchViolations", () => {
  it("flags ui → infra (forbidden by clean-arch rule) and keys by edge id", () => {
    const g = graph(
      [file("u.ts", "ui"), file("i.ts", "infra")],
      [edge("e1", "u.ts", "i.ts")],
    );
    const result = detectArchViolations(g);
    expect(result.violatingEdgeIds.has("e1")).toBe(true);
    expect(result.byPair.get("ui→infra")).toBe(1);
  });

  it("allows domain → util (permitted)", () => {
    const g = graph(
      [file("d.ts", "domain"), file("u.ts", "util")],
      [edge("e1", "d.ts", "u.ts")],
    );
    const result = detectArchViolations(g);
    expect(result.violatingEdgeIds.size).toBe(0);
    expect(result.byPair.size).toBe(0);
  });

  it("flags infra → ui (dependency inversion) as a violation", () => {
    const g = graph(
      [file("i.ts", "infra"), file("u.ts", "ui")],
      [edge("e1", "i.ts", "u.ts")],
    );
    const result = detectArchViolations(g);
    expect(result.violatingEdgeIds.has("e1")).toBe(true);
    expect(result.byPair.get("infra→ui")).toBe(1);
  });

  it("empty graph returns an empty result", () => {
    const result = detectArchViolations(graph([], []));
    expect(result.violatingEdgeIds.size).toBe(0);
    expect(result.byPair.size).toBe(0);
  });

  it("ignores non-architectural edge kinds (e.g. blast, dataflow)", () => {
    const g = graph(
      [file("u.ts", "ui"), file("i.ts", "infra")],
      [
        edge("blast1", "u.ts", "i.ts", "blast", "impact"),
        edge("flow1", "u.ts", "i.ts", "dataflow", "flow"),
      ],
    );
    const result = detectArchViolations(g);
    expect(result.violatingEdgeIds.size).toBe(0);
  });

  it("aggregates pair counts across multiple offending edges", () => {
    const g = graph(
      [file("u1.ts", "ui"), file("u2.ts", "ui"), file("i.ts", "infra")],
      [
        edge("e1", "u1.ts", "i.ts"),
        edge("e2", "u2.ts", "i.ts", "call"),
      ],
    );
    const result = detectArchViolations(g);
    expect(result.violatingEdgeIds.size).toBe(2);
    expect(result.byPair.get("ui→infra")).toBe(2);
  });
});
