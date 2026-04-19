import { describe, it, expect, beforeEach } from "vitest";
import type {
  WorkspaceGraph,
  WorkspaceLayout,
  WorkspaceView,
  FileNode,
  FileEdge,
  Rect,
} from "@quanta/canvas-engine";
import { estimateUniverseMemory } from "./estimate-memory";
import { sceneStore } from "../store/scene-store";

// The estimator is a pure function of sceneStore state: no params. Drive it
// by mutating sceneStore, then inspect the returned breakdown + counts.

function makeFile(id: string): FileNode {
  return {
    id,
    name: id,
    layer: "domain",
    riskScore: 0,
    loc: 1,
    signals: {
      taintCount: 0,
      blastCritical: 0,
      deadCount: 0,
      archViolations: 0,
      cpxMax: 0,
    },
    functions: [],
  };
}

function makeGraph(files: FileNode[], edges: FileEdge[] = []): WorkspaceGraph {
  return { files, fileEdges: edges, comments: [] };
}

function makeLayout(
  fileRects: ReadonlyArray<readonly [string, Rect]> = [],
): WorkspaceLayout {
  return {
    fileRects: new Map(fileRects),
    edgeRoutes: new Map(),
    aggregates: {
      commentsByFunction: new Map(),
      commentsByFile: new Map(),
      commentedLines: new Map(),
    },
    totalBounds: { x: 0, y: 0, w: 100, h: 100 },
  };
}

function resetScene(): void {
  // Direct override — cheaper than calling setGraph (which also clears
  // layout) and gives us a clean slate.
  sceneStore.setGraph({ files: [], fileEdges: [], comments: [] });
}

describe("estimateUniverseMemory", () => {
  beforeEach(() => {
    resetScene();
  });

  it("returns zero-ish baseline with an empty graph and no layout", () => {
    // After setGraph, layout is cleared, scenes are null, groundData is {}.
    const snap = estimateUniverseMemory();
    expect(snap.breakdown.layout).toBe(0);
    expect(snap.breakdown.visibleScene).toBe(0);
    expect(snap.breakdown.clusterScene).toBe(0);
    expect(snap.breakdown.superclusterScene).toBe(0);
    expect(snap.breakdown.groundData).toBe(0);
    // Graph is also empty but the estimator doesn't touch anything → 0.
    expect(snap.breakdown.graph).toBe(0);
    expect(snap.breakdown.total).toBe(0);
    expect(snap.counts.graphFiles).toBe(0);
  });

  it("graph contribution grows monotonically with file count", () => {
    sceneStore.setGraph(makeGraph([makeFile("a.ts")]));
    const one = estimateUniverseMemory().breakdown.graph;
    sceneStore.setGraph(makeGraph([makeFile("a.ts"), makeFile("b.ts")]));
    const two = estimateUniverseMemory().breakdown.graph;
    sceneStore.setGraph(makeGraph([
      makeFile("a.ts"), makeFile("b.ts"), makeFile("c.ts"), makeFile("d.ts"),
    ]));
    const four = estimateUniverseMemory().breakdown.graph;
    expect(two).toBeGreaterThan(one);
    expect(four).toBeGreaterThan(two);
    // Doubling file count should roughly double (within a generous factor —
    // string length varies, but the per-file object overhead dominates).
    expect(four).toBeGreaterThan(two * 1.5);
  });

  it("edges contribute to the graph breakdown", () => {
    const files = [makeFile("a.ts"), makeFile("b.ts")];
    sceneStore.setGraph(makeGraph(files));
    const noEdges = estimateUniverseMemory().breakdown.graph;
    const edge: FileEdge = {
      id: "e1", from: "a.ts", to: "b.ts", kind: "call", layer: "structural", weight: 1,
    };
    sceneStore.setGraph(makeGraph(files, [edge]));
    const withEdge = estimateUniverseMemory().breakdown.graph;
    expect(withEdge).toBeGreaterThan(noEdges);
  });

  it("layout fileRects contribute to the layout breakdown and counts", () => {
    sceneStore.setGraph(makeGraph([makeFile("a.ts"), makeFile("b.ts")]));
    sceneStore.setLayout(makeLayout([
      ["a.ts", { x: 0, y: 0, w: 10, h: 10 }],
      ["b.ts", { x: 20, y: 0, w: 10, h: 10 }],
    ]));
    const snap = estimateUniverseMemory();
    expect(snap.counts.layoutFileRects).toBe(2);
    expect(snap.breakdown.layout).toBeGreaterThan(0);
  });

  it("visibleScene contributes when set", () => {
    sceneStore.setGraph(makeGraph([makeFile("a.ts")]));
    const view: WorkspaceView = {
      files: [makeFile("a.ts")],
      edges: [],
      comments: [],
      kind: "files",
    };
    sceneStore.setVisibleScene(view);
    const snap = estimateUniverseMemory();
    expect(snap.breakdown.visibleScene).toBeGreaterThan(0);
    expect(snap.counts.visibleFiles).toBe(1);
  });

  it("total equals the sum of all breakdown components", () => {
    sceneStore.setGraph(makeGraph([makeFile("a.ts")]));
    sceneStore.setLayout(makeLayout([["a.ts", { x: 0, y: 0, w: 10, h: 10 }]]));
    const { breakdown } = estimateUniverseMemory();
    const sum =
      breakdown.graph +
      breakdown.layout +
      breakdown.visibleScene +
      breakdown.clusterScene +
      breakdown.superclusterScene +
      breakdown.groundData;
    expect(breakdown.total).toBe(sum);
  });

  it("is deterministic: two calls on the same store state return equal numbers", () => {
    sceneStore.setGraph(makeGraph([makeFile("a.ts"), makeFile("b.ts")]));
    sceneStore.setLayout(makeLayout([
      ["a.ts", { x: 0, y: 0, w: 10, h: 10 }],
      ["b.ts", { x: 20, y: 0, w: 10, h: 10 }],
    ]));
    const a = estimateUniverseMemory();
    const b = estimateUniverseMemory();
    expect(a.breakdown.total).toBe(b.breakdown.total);
  });
});
