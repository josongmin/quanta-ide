import { describe, it, expect } from "vitest";
import { rankStartHere } from "./start-here";
import { computeWorkspaceMetrics } from "./metrics";
import type { FileEdge, FileNode } from "./types";

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

describe("rankStartHere", () => {
  it("scores main.ts entry-point above 0.5", () => {
    const files: FileNode[] = [makeFile("src/main.ts")];
    const graph = { files, fileEdges: [] as FileEdge[] };
    const metrics = computeWorkspaceMetrics(graph);
    const out = rankStartHere(graph, metrics);
    expect(out).toHaveLength(1);
    expect(out[0].breakdown.entryPoint).toBeGreaterThan(0.5);
  });

  it("ranks a high-centrality utility above a low-centrality leaf", () => {
    // hub has many connections; leaf file with arbitrary name has none.
    const files: FileNode[] = [
      makeFile("src/lib/hub.ts"),
      makeFile("src/lib/leaf-a.ts"),
      makeFile("src/lib/leaf-b.ts"),
      makeFile("src/lib/leaf-c.ts"),
      makeFile("src/lib/leaf-d.ts"),
    ];
    const edges: FileEdge[] = [
      makeEdge("src/lib/leaf-a.ts", "src/lib/hub.ts"),
      makeEdge("src/lib/leaf-b.ts", "src/lib/hub.ts"),
      makeEdge("src/lib/leaf-c.ts", "src/lib/hub.ts"),
      makeEdge("src/lib/leaf-d.ts", "src/lib/hub.ts"),
    ];
    const graph = { files, fileEdges: edges };
    const metrics = computeWorkspaceMetrics(graph, { computeBetweenness: true });
    const out = rankStartHere(graph, metrics);
    expect(out[0].fileId).toBe("src/lib/hub.ts");
  });

  it("breaks ties by fileId alphabetically for deterministic ordering", () => {
    // Three identical-score files (no edges, no entry-point name, no risk).
    const files: FileNode[] = [
      makeFile("z.ts"),
      makeFile("a.ts"),
      makeFile("m.ts"),
    ];
    const graph = { files, fileEdges: [] as FileEdge[] };
    const metrics = computeWorkspaceMetrics(graph);
    const out = rankStartHere(graph, metrics);
    expect(out.map(e => e.fileId)).toEqual(["a.ts", "m.ts", "z.ts"]);
    expect(out.map(e => e.rank)).toEqual([1, 2, 3]);
  });

  it("respects topN", () => {
    const files: FileNode[] = Array.from({ length: 20 }, (_, i) =>
      makeFile(`file-${i}.ts`),
    );
    const graph = { files, fileEdges: [] as FileEdge[] };
    const metrics = computeWorkspaceMetrics(graph);
    const out = rankStartHere(graph, metrics, 5);
    expect(out).toHaveLength(5);
    expect(out.map(e => e.rank)).toEqual([1, 2, 3, 4, 5]);
  });

  it("applies directory boost for routes/ controllers/", () => {
    const files: FileNode[] = [
      makeFile("src/routes/checkout.ts"),
      makeFile("src/lib/format.ts"),
    ];
    const graph = { files, fileEdges: [] as FileEdge[] };
    const metrics = computeWorkspaceMetrics(graph);
    const out = rankStartHere(graph, metrics);
    const router = out.find(e => e.fileId === "src/routes/checkout.ts")!;
    const util = out.find(e => e.fileId === "src/lib/format.ts")!;
    expect(router.breakdown.entryPoint).toBeGreaterThan(util.breakdown.entryPoint);
  });

  it("handles empty graphs", () => {
    expect(rankStartHere({ files: [], fileEdges: [] }, computeWorkspaceMetrics({ files: [], fileEdges: [] }))).toEqual([]);
  });
});
