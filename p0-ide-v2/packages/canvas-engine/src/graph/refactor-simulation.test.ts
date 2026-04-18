import { describe, it, expect } from "vitest";
import { simulateRefactor } from "./refactor-simulation";
import { computeRefactorROI } from "./refactor-roi";
import { computeWorkspaceMetrics } from "./metrics";
import type { RefactorPlan } from "./refactor-suggestions";
import type { FileEdge, FileNode, WorkspaceGraph } from "./types";

function makeFile(id: string, opts: Partial<FileNode> = {}): FileNode {
  return {
    id,
    name: id,
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

describe("simulateRefactor", () => {
  it("drops target file's score by projectedRoiDelta and halves for affected peers", () => {
    const files: FileNode[] = [
      makeFile("hub.ts", {
        loc: 1000,
        signals: { taintCount: 5, blastCritical: 2, deadCount: 0, archViolations: 0, cpxMax: 50 },
      }),
      makeFile("peer.ts", {
        loc: 800,
        signals: { taintCount: 4, blastCritical: 1, deadCount: 0, archViolations: 0, cpxMax: 40 },
      }),
      makeFile("bystander.ts", {
        loc: 500,
        signals: { taintCount: 1, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 10 },
      }),
    ];
    const edges: FileEdge[] = [makeEdge("hub.ts", "peer.ts"), makeEdge("peer.ts", "hub.ts")];
    const graph: WorkspaceGraph = { files, fileEdges: edges, comments: [] };
    const metrics = computeWorkspaceMetrics(graph);
    const roi = computeRefactorROI(graph, metrics);

    const hubBefore = roi.scores.get("hub.ts")!.score;
    const peerBefore = roi.scores.get("peer.ts")!.score;
    const bystanderBefore = roi.scores.get("bystander.ts")!.score;

    const plan: RefactorPlan = {
      id: "break-cycle:hub.ts",
      kind: "break-cycle",
      fileId: "hub.ts",
      title: "t",
      rationale: "r",
      projectedRoiDelta: -10,
      affectedFileIds: ["peer.ts"],
      confidence: 0.9,
    };
    const sim = simulateRefactor(roi, plan);

    expect(sim.after.perFile.get("hub.ts")).toBeCloseTo(Math.max(0, hubBefore - 10));
    expect(sim.after.perFile.get("peer.ts")).toBeCloseTo(Math.max(0, peerBefore - 5));
    expect(sim.after.perFile.get("bystander.ts")).toBe(bystanderBefore);
    expect(sim.confidence).toBe(0.9);
  });

  it("clamps after-scores to 0..100", () => {
    const files: FileNode[] = [makeFile("a.ts", { loc: 100 })];
    const graph: WorkspaceGraph = { files, fileEdges: [], comments: [] };
    const metrics = computeWorkspaceMetrics(graph);
    const roi = computeRefactorROI(graph, metrics);
    const plan: RefactorPlan = {
      id: "split-file:a.ts",
      kind: "split-file",
      fileId: "a.ts",
      title: "t",
      rationale: "r",
      // Large negative delta — must clamp at 0, not go negative.
      projectedRoiDelta: -500,
      affectedFileIds: [],
      confidence: 0.8,
    };
    const sim = simulateRefactor(roi, plan);
    expect(sim.after.perFile.get("a.ts")).toBe(0);
  });

  it("totals reflect per-file sums", () => {
    const files: FileNode[] = [
      makeFile("a.ts", { loc: 100, signals: { taintCount: 3, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 20 } }),
      makeFile("b.ts", { loc: 50, signals: { taintCount: 1, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 5 } }),
    ];
    const graph: WorkspaceGraph = { files, fileEdges: [], comments: [] };
    const metrics = computeWorkspaceMetrics(graph);
    const roi = computeRefactorROI(graph, metrics);

    const plan: RefactorPlan = {
      id: "split-file:a.ts",
      kind: "split-file",
      fileId: "a.ts",
      title: "t",
      rationale: "r",
      projectedRoiDelta: -5,
      affectedFileIds: [],
      confidence: 0.8,
    };
    const sim = simulateRefactor(roi, plan);
    let expectedBefore = 0;
    let expectedAfter = 0;
    for (const s of sim.before.perFile.values()) expectedBefore += s;
    for (const s of sim.after.perFile.values()) expectedAfter += s;
    expect(sim.before.total).toBeCloseTo(expectedBefore);
    expect(sim.after.total).toBeCloseTo(expectedAfter);
    expect(sim.after.total).toBeLessThan(sim.before.total);
  });

  it("terrainDelta skips unchanged files", () => {
    const files: FileNode[] = [
      makeFile("a.ts", { loc: 100, signals: { taintCount: 3, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 20 } }),
      makeFile("b.ts"),
    ];
    const graph: WorkspaceGraph = { files, fileEdges: [], comments: [] };
    const metrics = computeWorkspaceMetrics(graph);
    const roi = computeRefactorROI(graph, metrics);
    const plan: RefactorPlan = {
      id: "split-file:a.ts",
      kind: "split-file",
      fileId: "a.ts",
      title: "t",
      rationale: "r",
      projectedRoiDelta: -5,
      affectedFileIds: [],
      confidence: 0.8,
    };
    const sim = simulateRefactor(roi, plan);
    expect(sim.terrainDelta.has("b.ts")).toBe(false);
    // a.ts may be 0 both before and after if the initial score was already 0;
    // test intent is "files whose score is identical are omitted".
    const aChanged = sim.before.perFile.get("a.ts") !== sim.after.perFile.get("a.ts");
    expect(sim.terrainDelta.has("a.ts")).toBe(aChanged);
  });

  it("zero-delta plan produces no terrain changes", () => {
    const files: FileNode[] = [makeFile("a.ts", { loc: 100 })];
    const graph: WorkspaceGraph = { files, fileEdges: [], comments: [] };
    const metrics = computeWorkspaceMetrics(graph);
    const roi = computeRefactorROI(graph, metrics);
    const plan: RefactorPlan = {
      id: "split-file:a.ts",
      kind: "split-file",
      fileId: "a.ts",
      title: "t",
      rationale: "r",
      projectedRoiDelta: 0,
      affectedFileIds: [],
      confidence: 0.8,
    };
    const sim = simulateRefactor(roi, plan);
    expect(sim.terrainDelta.size).toBe(0);
    expect(sim.before.total).toBe(sim.after.total);
  });
});
