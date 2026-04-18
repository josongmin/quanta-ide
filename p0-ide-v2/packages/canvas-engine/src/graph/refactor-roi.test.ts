import { describe, it, expect } from "vitest";
import {
  computeRefactorROI,
  DEFAULT_ROI_WEIGHTS,
} from "./refactor-roi";
import { computeWorkspaceMetrics } from "./metrics";
import type { FileEdge, FileNode, WorkspaceGraph } from "./types";
import type { FileBlame } from "./blame";

function makeFile(id: string, opts: Partial<FileNode> = {}): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "unknown",
    riskScore: 0,
    loc: 0,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
    ...opts,
  };
}

function makeEdge(from: string, to: string): FileEdge {
  return { id: `${from}->${to}`, from, to, kind: "import", layer: "structural", weight: 1 };
}

describe("computeRefactorROI", () => {
  it("has default weights summing to 1", () => {
    const sum =
      DEFAULT_ROI_WEIGHTS.churn +
      DEFAULT_ROI_WEIGHTS.complexity +
      DEFAULT_ROI_WEIGHTS.fanIn +
      DEFAULT_ROI_WEIGHTS.testDebt +
      DEFAULT_ROI_WEIGHTS.cycleMembership;
    expect(sum).toBeCloseTo(1.0, 6);
  });

  it("returns empty result for empty graph", () => {
    const graph: WorkspaceGraph = { files: [], fileEdges: [], comments: [] };
    const metrics = computeWorkspaceMetrics(graph);
    const r = computeRefactorROI(graph, metrics);
    expect(r.ordered).toHaveLength(0);
    expect(r.maxScore).toBe(0);
    expect(r.scores.size).toBe(0);
  });

  it("ranks a hub with heavy signals above an empty leaf", () => {
    const files: FileNode[] = [
      makeFile("hub.ts", {
        loc: 500,
        signals: { taintCount: 5, blastCritical: 3, deadCount: 0, archViolations: 0, cpxMax: 30 },
      }),
      makeFile("leafA.ts"),
      makeFile("leafB.ts"),
      makeFile("leafC.ts"),
    ];
    const edges: FileEdge[] = [
      makeEdge("leafA.ts", "hub.ts"),
      makeEdge("leafB.ts", "hub.ts"),
      makeEdge("leafC.ts", "hub.ts"),
    ];
    const graph: WorkspaceGraph = { files, fileEdges: edges, comments: [] };
    const metrics = computeWorkspaceMetrics(graph);
    const r = computeRefactorROI(graph, metrics);
    expect(r.ordered[0].fileId).toBe("hub.ts");
    expect(r.ordered[0].rank).toBe(1);
    expect(r.ordered[0].score).toBeGreaterThan(0);
    // leaves with no signals/degree collapse to zero composite.
    const leaf = r.scores.get("leafA.ts")!;
    expect(leaf.components.fanIn).toBe(0);
  });

  it("applies cycleMembership when SCCs provided", () => {
    const files: FileNode[] = [makeFile("a.ts"), makeFile("b.ts")];
    const graph: WorkspaceGraph = {
      files,
      fileEdges: [makeEdge("a.ts", "b.ts"), makeEdge("b.ts", "a.ts")],
      comments: [],
    };
    const metrics = computeWorkspaceMetrics(graph);
    const withScc = computeRefactorROI(graph, metrics, {
      sccs: [["a.ts", "b.ts"]],
    });
    const withoutScc = computeRefactorROI(graph, metrics);
    expect(withScc.scores.get("a.ts")!.components.cycleMembership).toBeGreaterThan(0);
    expect(withoutScc.scores.get("a.ts")!.components.cycleMembership).toBe(0);
    expect(withScc.scores.get("a.ts")!.score).toBeGreaterThan(
      withoutScc.scores.get("a.ts")!.score,
    );
  });

  it("derives churn component from blame entries in last 90 days", () => {
    const now = 1_000_000_000_000;
    const recentMs = now - 10 * 86_400_000;
    const oldMs = now - 400 * 86_400_000;
    const blame: Record<string, FileBlame> = {
      "hot.ts": {
        fileId: "hot.ts",
        lineCount: 100,
        entries: [
          { startLine: 1, endLine: 80, committedAt: recentMs, author: "alice" },
          { startLine: 81, endLine: 100, committedAt: oldMs, author: "bob" },
        ],
      },
      "cold.ts": {
        fileId: "cold.ts",
        lineCount: 100,
        entries: [
          { startLine: 1, endLine: 100, committedAt: oldMs, author: "carol" },
        ],
      },
    };
    const files: FileNode[] = [
      makeFile("hot.ts", { loc: 100 }),
      makeFile("cold.ts", { loc: 100 }),
    ];
    const graph: WorkspaceGraph = { files, fileEdges: [], comments: [], blame };
    const metrics = computeWorkspaceMetrics(graph);
    const r = computeRefactorROI(graph, metrics, { now });
    expect(r.scores.get("hot.ts")!.components.churn).toBeGreaterThan(70);
    expect(r.scores.get("cold.ts")!.components.churn).toBe(0);
  });

  it("breaks score ties by fileId ascending and assigns ranks 1..N", () => {
    // Three identical, zero-signal files — same composite score.
    const files: FileNode[] = [makeFile("z.ts"), makeFile("a.ts"), makeFile("m.ts")];
    const graph: WorkspaceGraph = { files, fileEdges: [], comments: [] };
    const metrics = computeWorkspaceMetrics(graph);
    const r = computeRefactorROI(graph, metrics);
    expect(r.ordered.map(e => e.fileId)).toEqual(["a.ts", "m.ts", "z.ts"]);
    expect(r.ordered.map(e => e.rank)).toEqual([1, 2, 3]);
  });

  it("respects custom weight overrides", () => {
    const files: FileNode[] = [
      makeFile("hub.ts", {
        loc: 100,
        signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
      }),
      makeFile("leaf.ts"),
    ];
    const edges: FileEdge[] = [makeEdge("leaf.ts", "hub.ts")];
    const graph: WorkspaceGraph = { files, fileEdges: edges, comments: [] };
    const metrics = computeWorkspaceMetrics(graph);
    // With all weight on fanIn, hub must dominate by a wide margin.
    const r = computeRefactorROI(graph, metrics, {
      weights: { churn: 0, complexity: 0, fanIn: 1, testDebt: 0, cycleMembership: 0 },
    });
    expect(r.scores.get("hub.ts")!.score).toBe(100);
    expect(r.scores.get("leaf.ts")!.score).toBe(0);
  });
});
