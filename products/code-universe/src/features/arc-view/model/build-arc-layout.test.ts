import { describe, it, expect } from "vitest";
import {
  buildEntityTree,
  type FileEdge,
  type FileNode,
  type WorkspaceGraph,
} from "@quanta/canvas-engine";
import { buildArcLayout } from "./build-arc-layout";

// ─────────────────────────────────────────────────────────────────────
// Test helpers

function makeFile(id: string, loc = 10): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "domain",
    riskScore: 20,
    loc,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
  };
}

function makeEdge(id: string, from: string, to: string, kind: FileEdge["kind"] = "import"): FileEdge {
  return { id, from, to, kind, layer: "structural", weight: 1 };
}

function makeGraph(files: FileNode[], edges: FileEdge[] = []): WorkspaceGraph {
  return { files, fileEdges: edges, comments: [] };
}

const VIEWPORT = { width: 1600, height: 900 };

// ─────────────────────────────────────────────────────────────────────

describe("buildArcLayout — 1. empty tree", () => {
  it("returns an empty layout for a workspace with no files", () => {
    const tree = buildEntityTree(makeGraph([]));
    const layout = buildArcLayout({
      tree,
      graph: makeGraph([]),
      ...VIEWPORT,
    });
    expect(layout.nodes).toHaveLength(0);
    expect(layout.edges).toHaveLength(0);
    expect(layout.sccCount).toBe(0);
    expect(layout.cycleEdgeCount).toBe(0);
    expect(layout.overflow).toBe(0);
  });
});

describe("buildArcLayout — 2. linear chain (no cycles)", () => {
  // pkgA → pkgB → pkgC: pure DAG, no backward edges.
  const files = [
    makeFile("pkgA/a.ts"),
    makeFile("pkgB/b.ts"),
    makeFile("pkgC/c.ts"),
  ];
  const edges = [
    makeEdge("e1", "pkgA/a.ts", "pkgB/b.ts"),
    makeEdge("e2", "pkgB/b.ts", "pkgC/c.ts"),
  ];
  const graph = makeGraph(files, edges);
  const tree = buildEntityTree(graph);

  it("reports 0 SCCs and 0 backward edges", () => {
    const layout = buildArcLayout({ tree, graph, ...VIEWPORT });
    expect(layout.sccCount).toBe(0);
    expect(layout.cycleEdgeCount).toBe(0);
  });

  it("emits 3 nodes and 2 edges", () => {
    const layout = buildArcLayout({ tree, graph, ...VIEWPORT });
    expect(layout.nodes).toHaveLength(3);
    expect(layout.edges).toHaveLength(2);
  });

  it("topological order places pkgA before pkgB before pkgC", () => {
    const layout = buildArcLayout({ tree, graph, ...VIEWPORT });
    const galaxies = tree.byKind("galaxy");
    const pkgAId = galaxies.find(g => g.name === "pkgA")?.id;
    const pkgBId = galaxies.find(g => g.name === "pkgB")?.id;
    const pkgCId = galaxies.find(g => g.name === "pkgC")?.id;
    expect(pkgAId).toBeDefined();
    expect(pkgBId).toBeDefined();
    expect(pkgCId).toBeDefined();
    const indexMap = new Map(layout.nodes.map(n => [n.id, n.index]));
    expect(indexMap.get(pkgAId!)).toBeLessThan(indexMap.get(pkgBId!)!);
    expect(indexMap.get(pkgBId!)).toBeLessThan(indexMap.get(pkgCId!)!);
  });

  it("all forward arcs bow above baseline (isBackward=false)", () => {
    const layout = buildArcLayout({ tree, graph, ...VIEWPORT });
    for (const e of layout.edges) {
      expect(e.isBackward).toBe(false);
    }
  });
});

describe("buildArcLayout — 3. cycle A→B→C→A", () => {
  // A fully cyclic triangle: A imports B, B imports C, C imports A.
  const files = [
    makeFile("pkgA/a.ts"),
    makeFile("pkgB/b.ts"),
    makeFile("pkgC/c.ts"),
  ];
  const edges = [
    makeEdge("e1", "pkgA/a.ts", "pkgB/b.ts"),
    makeEdge("e2", "pkgB/b.ts", "pkgC/c.ts"),
    makeEdge("e3", "pkgC/c.ts", "pkgA/a.ts"),
  ];
  const graph = makeGraph(files, edges);
  const tree = buildEntityTree(graph);

  it("detects 1 SCC for the three-way cycle", () => {
    const layout = buildArcLayout({ tree, graph, ...VIEWPORT });
    expect(layout.sccCount).toBe(1);
  });

  it("has at least one backward edge (cycle edge)", () => {
    const layout = buildArcLayout({ tree, graph, ...VIEWPORT });
    expect(layout.cycleEdgeCount).toBeGreaterThan(0);
  });

  it("marks all three cycle nodes as inCycle=true", () => {
    const layout = buildArcLayout({ tree, graph, ...VIEWPORT });
    for (const node of layout.nodes) {
      expect(node.inCycle).toBe(true);
    }
  });

  it("backward edges have the same sccIndex as their endpoints", () => {
    const layout = buildArcLayout({ tree, graph, ...VIEWPORT });
    const nodeById = new Map(layout.nodes.map(n => [n.id, n]));
    for (const e of layout.edges) {
      if (e.isBackward) {
        const from = nodeById.get(e.fromId)!;
        const to = nodeById.get(e.toId)!;
        expect(from.sccIndex).toBeDefined();
        expect(to.sccIndex).toBeDefined();
        // Both endpoints of a cycle edge must be in a non-trivial SCC.
        expect(from.inCycle).toBe(true);
        expect(to.inCycle).toBe(true);
      }
    }
  });
});

describe("buildArcLayout — 4. maxNodes trim", () => {
  // Create 5 packages but cap at 3 — overflow must be 2.
  const files = [
    makeFile("pkgA/a.ts"),
    makeFile("pkgB/b.ts"),
    makeFile("pkgC/c.ts"),
    makeFile("pkgD/d.ts"),
    makeFile("pkgE/e.ts"),
  ];
  const graph = makeGraph(files);
  const tree = buildEntityTree(graph);

  it("trims to maxNodes and records the correct overflow count", () => {
    const layout = buildArcLayout({ tree, graph, ...VIEWPORT, maxNodes: 3 });
    expect(layout.nodes).toHaveLength(3);
    expect(layout.overflow).toBe(2);
  });

  it("overflow is 0 when nodes fit within maxNodes", () => {
    const layout = buildArcLayout({ tree, graph, ...VIEWPORT, maxNodes: 10 });
    expect(layout.nodes).toHaveLength(5);
    expect(layout.overflow).toBe(0);
  });
});

describe("buildArcLayout — 5. self-loop skipped", () => {
  // A→A at the file level: after rollup to galaxy it becomes a
  // galaxy self-loop which must be dropped (not treated as a cycle).
  const files = [makeFile("pkgA/a.ts"), makeFile("pkgB/b.ts")];
  const edges = [
    // Self-loop at file level
    makeEdge("sl", "pkgA/a.ts", "pkgA/a.ts"),
    // A normal edge so at least one edge exists in the graph
    makeEdge("e1", "pkgA/a.ts", "pkgB/b.ts"),
  ];
  const graph = makeGraph(files, edges);
  const tree = buildEntityTree(graph);

  it("self-loop is skipped — SCC count is 0 and inCycle=false for pkgA", () => {
    const layout = buildArcLayout({ tree, graph, ...VIEWPORT });
    expect(layout.sccCount).toBe(0);
    const galaxies = tree.byKind("galaxy");
    const pkgA = galaxies.find(g => g.name === "pkgA");
    expect(pkgA).toBeDefined();
    const node = layout.nodes.find(n => n.id === pkgA!.id);
    expect(node).toBeDefined();
    expect(node!.inCycle).toBe(false);
  });

  it("only the forward A→B edge is emitted (not the self-loop)", () => {
    const layout = buildArcLayout({ tree, graph, ...VIEWPORT });
    // The self-loop rolls up to pkgA→pkgA which is skipped; only pkgA→pkgB survives.
    expect(layout.edges).toHaveLength(1);
    const e = layout.edges[0]!;
    expect(e.isBackward).toBe(false);
  });
});

describe("buildArcLayout — node positions", () => {
  it("each node x equals (index + 1) * nodeSpacing", () => {
    const files = [makeFile("pkgA/a.ts"), makeFile("pkgB/b.ts")];
    const graph = makeGraph(files);
    const tree = buildEntityTree(graph);
    const layout = buildArcLayout({ tree, graph, ...VIEWPORT });
    for (const node of layout.nodes) {
      expect(node.x).toBeCloseTo((node.index + 1) * layout.nodeSpacing, 5);
    }
  });
});

describe("buildArcLayout — determinism", () => {
  it("produces bit-identical output for identical inputs", () => {
    const files = [
      makeFile("pkgA/a1.ts"),
      makeFile("pkgA/a2.ts"),
      makeFile("pkgB/b1.ts"),
      makeFile("pkgC/c1.ts"),
    ];
    const edges = [
      makeEdge("e1", "pkgA/a1.ts", "pkgB/b1.ts"),
      makeEdge("e2", "pkgB/b1.ts", "pkgC/c1.ts"),
      makeEdge("e3", "pkgC/c1.ts", "pkgA/a2.ts"),
    ];
    const graph = makeGraph(files, edges);
    const tree = buildEntityTree(graph);
    const opts = { tree, graph, ...VIEWPORT };
    const a = buildArcLayout(opts);
    const b = buildArcLayout(opts);
    expect(a).toEqual(b);
  });
});
