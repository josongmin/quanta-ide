import { describe, it, expect } from "vitest";
import { buildRefactorSuggestions } from "./refactor-suggestions";
import { computeRefactorROI } from "./refactor-roi";
import { computeWorkspaceMetrics } from "./metrics";
import type { FileEdge, FileNode, WorkspaceGraph } from "./types";

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

describe("buildRefactorSuggestions", () => {
  it("returns empty map when roi has no files", () => {
    const graph: WorkspaceGraph = { files: [], fileEdges: [], comments: [] };
    const metrics = computeWorkspaceMetrics(graph);
    const roi = computeRefactorROI(graph, metrics);
    const out = buildRefactorSuggestions(roi);
    expect(out.size).toBe(0);
  });

  it("emits break-cycle when cycleMembership is high and sccs are given", () => {
    // 4-node SCC → size × 15 = 60 > 50 threshold.
    const files: FileNode[] = [
      makeFile("a.ts"),
      makeFile("b.ts"),
      makeFile("c.ts"),
      makeFile("d.ts"),
    ];
    const graph: WorkspaceGraph = {
      files,
      fileEdges: [
        makeEdge("a.ts", "b.ts"),
        makeEdge("b.ts", "c.ts"),
        makeEdge("c.ts", "d.ts"),
        makeEdge("d.ts", "a.ts"),
      ],
      comments: [],
    };
    const metrics = computeWorkspaceMetrics(graph);
    const sccs = [["a.ts", "b.ts", "c.ts", "d.ts"]];
    const roi = computeRefactorROI(graph, metrics, { sccs });
    const out = buildRefactorSuggestions(roi, { sccs });
    const aPlans = out.get("a.ts")!;
    expect(aPlans.some(p => p.kind === "break-cycle")).toBe(true);
    const plan = aPlans.find(p => p.kind === "break-cycle")!;
    expect(plan.id).toBe("break-cycle:a.ts");
    expect(plan.confidence).toBe(0.9);
    expect(plan.affectedFileIds).toEqual(["b.ts", "c.ts", "d.ts"]);
    expect(plan.projectedRoiDelta).toBeLessThan(0);
  });

  it("emits split-file for high complexity", () => {
    const files: FileNode[] = [
      makeFile("big.ts", {
        loc: 2000,
        signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 80 },
      }),
    ];
    const graph: WorkspaceGraph = { files, fileEdges: [], comments: [] };
    const metrics = computeWorkspaceMetrics(graph);
    const roi = computeRefactorROI(graph, metrics);
    // Sanity: complexity must be above 70 for the rule to fire.
    expect(roi.scores.get("big.ts")!.components.complexity).toBeGreaterThan(70);
    const out = buildRefactorSuggestions(roi, { maxPerFile: 3 });
    const plans = out.get("big.ts")!;
    expect(plans.some(p => p.kind === "split-file")).toBe(true);
  });

  it("emits add-tests when testDebt dominates", () => {
    const files: FileNode[] = [
      makeFile("risky.ts", {
        loc: 50,
        signals: { taintCount: 8, blastCritical: 4, deadCount: 0, archViolations: 0, cpxMax: 5 },
      }),
      makeFile("clean.ts"),
    ];
    const graph: WorkspaceGraph = { files, fileEdges: [], comments: [] };
    const metrics = computeWorkspaceMetrics(graph);
    const roi = computeRefactorROI(graph, metrics);
    const out = buildRefactorSuggestions(roi);
    const plans = out.get("risky.ts")!;
    expect(plans.some(p => p.kind === "add-tests")).toBe(true);
  });

  it("caps plans per file at maxPerFile", () => {
    // File matching multiple rules: high complexity + high fanIn + high testDebt + high cycle.
    const leaves: FileNode[] = Array.from({ length: 6 }, (_, i) => makeFile(`leaf-${i}.ts`));
    const hub = makeFile("hub.ts", {
      loc: 2000,
      signals: { taintCount: 10, blastCritical: 5, deadCount: 0, archViolations: 0, cpxMax: 80 },
    });
    const files: FileNode[] = [hub, ...leaves];
    const edges: FileEdge[] = leaves.map(l => makeEdge(l.id, "hub.ts"));
    const graph: WorkspaceGraph = { files, fileEdges: edges, comments: [] };
    const metrics = computeWorkspaceMetrics(graph);
    const roi = computeRefactorROI(graph, metrics);
    const out = buildRefactorSuggestions(roi, { maxPerFile: 2 });
    const plans = out.get("hub.ts")!;
    expect(plans.length).toBeLessThanOrEqual(2);
  });

  it("plan ids are stable and follow kind:fileId format", () => {
    const files: FileNode[] = [
      makeFile("x.ts", {
        loc: 1000,
        signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 60 },
      }),
    ];
    const graph: WorkspaceGraph = { files, fileEdges: [], comments: [] };
    const metrics = computeWorkspaceMetrics(graph);
    const roi = computeRefactorROI(graph, metrics);
    const out = buildRefactorSuggestions(roi);
    const plans = out.get("x.ts") ?? [];
    for (const p of plans) {
      expect(p.id).toBe(`${p.kind}:${p.fileId}`);
    }
  });
});
