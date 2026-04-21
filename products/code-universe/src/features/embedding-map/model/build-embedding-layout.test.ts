import { describe, it, expect } from "vitest";
import {
  buildEntityTree,
  type FileEdge,
  type FileNode,
  type WorkspaceGraph,
} from "@quanta/canvas-engine";
import { buildEmbeddingLayout } from "./build-embedding-layout";

// ── Test helpers ─────────────────────────────────────────────────────

function makeFile(
  id: string,
  opts: {
    loc?: number;
    riskScore?: number;
    taintCount?: number;
    archViolations?: number;
    cpxMax?: number;
  } = {},
): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "domain",
    riskScore: opts.riskScore ?? 0,
    loc: opts.loc ?? 10,
    signals: {
      taintCount: opts.taintCount ?? 0,
      blastCritical: 0,
      deadCount: 0,
      archViolations: opts.archViolations ?? 0,
      cpxMax: opts.cpxMax ?? 0,
    },
    functions: [],
  };
}

function makeEdge(
  id: string,
  from: string,
  to: string,
  kind: FileEdge["kind"] = "import",
): FileEdge {
  return { id, from, to, kind, layer: "structural", weight: 1 };
}

function makeGraph(files: FileNode[], edges: FileEdge[] = []): WorkspaceGraph {
  return { files, fileEdges: edges, comments: [] };
}

const VIEWPORT = { width: 1600, height: 1000 };

// ─────────────────────────────────────────────────────────────────────

describe("buildEmbeddingLayout — empty tree", () => {
  it("returns empty layout for a workspace with no files", () => {
    const graph = makeGraph([]);
    const tree = buildEntityTree(graph);
    const layout = buildEmbeddingLayout({
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(layout.points).toHaveLength(0);
    expect(layout.clusters).toHaveLength(0);
    expect(layout.overflow).toBe(0);
  });
});

describe("buildEmbeddingLayout — single galaxy", () => {
  it("produces 1 point at approximately viewport center with 0 overflow", () => {
    const files = [makeFile("pkgA/a.ts"), makeFile("pkgA/b.ts")];
    const graph = makeGraph(files);
    const tree = buildEntityTree(graph);
    const layout = buildEmbeddingLayout({
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(layout.points).toHaveLength(1);
    expect(layout.overflow).toBe(0);

    // With a single point there is nothing to spread against, so the
    // projection collapses to the center after normalization.
    const pt = layout.points[0]!;
    expect(pt.x).toBeCloseTo(VIEWPORT.width / 2, 0);
    expect(pt.y).toBeCloseTo(VIEWPORT.height / 2, 0);

    // Cluster — should have exactly 1 cluster containing the 1 point.
    expect(layout.clusters).toHaveLength(1);
    expect(layout.clusters[0]!.centroidId).toBe(pt.id);
  });
});

describe("buildEmbeddingLayout — two galaxies with different profiles", () => {
  it("projects high-risk / high-fanIn galaxy to a different position than low-risk galaxy", () => {
    // pkgA: high riskScore + many taint signals → high-dimensional feature values.
    const pkgAFiles = [
      makeFile("pkgA/a.ts", { riskScore: 0.9, taintCount: 10, cpxMax: 50, loc: 500 }),
      makeFile("pkgA/b.ts", { riskScore: 0.8, taintCount: 8, cpxMax: 40, loc: 400 }),
    ];
    // pkgB: low riskScore + minimal signals → low-dimensional feature values.
    const pkgBFiles = [
      makeFile("pkgB/c.ts", { riskScore: 0.05, taintCount: 0, cpxMax: 2, loc: 20 }),
      makeFile("pkgB/d.ts", { riskScore: 0.05, taintCount: 0, cpxMax: 1, loc: 15 }),
    ];
    const files = [...pkgAFiles, ...pkgBFiles];
    // Add cross-edges so pkgA has high fanIn.
    const edges = [
      makeEdge("e1", "pkgB/c.ts", "pkgA/a.ts"),
      makeEdge("e2", "pkgB/d.ts", "pkgA/b.ts"),
    ];
    const graph = makeGraph(files, edges);
    const tree = buildEntityTree(graph);
    const layout = buildEmbeddingLayout({
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(layout.points).toHaveLength(2);

    const ptA = layout.points.find(p => p.label === "pkgA")!;
    const ptB = layout.points.find(p => p.label === "pkgB")!;
    expect(ptA).toBeDefined();
    expect(ptB).toBeDefined();

    // The two galaxies have very different structural profiles, so their
    // projected positions should be meaningfully separated (>0.1 in
    // normalized viewport distance).
    const dx = ptA.x - ptB.x;
    const dy = ptA.y - ptB.y;
    const dist = Math.sqrt(dx * dx + dy * dy);
    // With spread normalization the distance should be well above 0.1
    // (in SVG px, the scale factor is plotWidth * 0.42 ≈ 420 px).
    expect(dist).toBeGreaterThan(0.1);
  });
});

describe("buildEmbeddingLayout — k-means clusters", () => {
  it("assigns each of 3 galaxies to its own cluster when numClusters=3", () => {
    const files = [
      makeFile("pkgA/a.ts"),
      makeFile("pkgB/b.ts"),
      makeFile("pkgC/c.ts"),
    ];
    const graph = makeGraph(files);
    const tree = buildEntityTree(graph);
    const layout = buildEmbeddingLayout({
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      numClusters: 3,
    });
    expect(layout.points).toHaveLength(3);
    expect(layout.clusters).toHaveLength(3);

    // Each cluster should have exactly one representative point.
    const clusterIds = layout.points.map(p => p.clusterId);
    const uniqueClusters = new Set(clusterIds);
    expect(uniqueClusters.size).toBe(3);
  });
});

describe("buildEmbeddingLayout — maxPoints trim", () => {
  it("trims points to maxPoints and records overflow correctly", () => {
    // Create 5 galaxies.
    const files = [
      makeFile("pkgA/a.ts"),
      makeFile("pkgB/b.ts"),
      makeFile("pkgC/c.ts"),
      makeFile("pkgD/d.ts"),
      makeFile("pkgE/e.ts"),
    ];
    const graph = makeGraph(files);
    const tree = buildEntityTree(graph);
    const layout = buildEmbeddingLayout({
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      maxPoints: 3,
    });
    expect(layout.points).toHaveLength(3);
    expect(layout.overflow).toBe(2);
  });

  it("overflow is 0 when number of entities <= maxPoints", () => {
    const files = [makeFile("pkgA/a.ts"), makeFile("pkgB/b.ts")];
    const graph = makeGraph(files);
    const tree = buildEntityTree(graph);
    const layout = buildEmbeddingLayout({
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      maxPoints: 100,
    });
    expect(layout.overflow).toBe(0);
  });
});

describe("buildEmbeddingLayout — sublabel format", () => {
  it("sublabel contains fileCount, risk, and fanIn", () => {
    const files = [
      makeFile("pkgA/a.ts", { riskScore: 0.5, loc: 100 }),
      makeFile("pkgA/b.ts", { riskScore: 0.3, loc: 50 }),
      makeFile("pkgB/c.ts"),
    ];
    const edges = [makeEdge("e1", "pkgB/c.ts", "pkgA/a.ts")];
    const graph = makeGraph(files, edges);
    const tree = buildEntityTree(graph);
    const layout = buildEmbeddingLayout({
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    const pkgA = layout.points.find(p => p.label === "pkgA")!;
    expect(pkgA).toBeDefined();
    // sublabel must contain "files", "risk", "fanIn".
    expect(pkgA.sublabel).toMatch(/files/);
    expect(pkgA.sublabel).toMatch(/risk/);
    expect(pkgA.sublabel).toMatch(/fanIn/);
    // "2 files" for pkgA (a.ts + b.ts).
    expect(pkgA.sublabel).toMatch(/2 files/);
  });
});

describe("buildEmbeddingLayout — determinism", () => {
  it("produces bit-identical output for identical input", () => {
    const files = [
      makeFile("pkgA/a.ts", { riskScore: 0.5, loc: 200, taintCount: 3 }),
      makeFile("pkgB/b.ts", { riskScore: 0.2, loc: 80 }),
      makeFile("pkgC/c.ts", { riskScore: 0.8, loc: 500, cpxMax: 30 }),
    ];
    const edges = [
      makeEdge("e1", "pkgA/a.ts", "pkgB/b.ts"),
      makeEdge("e2", "pkgC/c.ts", "pkgA/a.ts"),
    ];
    const graph = makeGraph(files, edges);
    const tree = buildEntityTree(graph);
    const opts = {
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    };
    const a = buildEmbeddingLayout(opts);
    const b = buildEmbeddingLayout(opts);
    expect(a).toEqual(b);
  });
});

describe("buildEmbeddingLayout — scopeId", () => {
  it("throws when scopeId is not in the tree", () => {
    const graph = makeGraph([makeFile("pkgA/a.ts")]);
    const tree = buildEntityTree(graph);
    expect(() =>
      buildEmbeddingLayout({
        tree,
        graph,
        width: VIEWPORT.width,
        height: VIEWPORT.height,
        scopeId: "does-not-exist",
      }),
    ).toThrow(/scopeId "does-not-exist" not found in tree/);
  });
});
