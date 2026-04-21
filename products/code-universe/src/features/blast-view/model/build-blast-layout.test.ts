import { describe, it, expect } from "vitest";
import {
  buildEntityTree,
  type FileEdge,
  type FileNode,
  type WorkspaceGraph,
} from "@quanta/canvas-engine";
import { buildBlastLayout } from "./build-blast-layout";

// ── Test helpers ─────────────────────────────────────────────────────

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

function makeEdge(
  id: string,
  from: string,
  to: string,
  kind: FileEdge["kind"] = "import",
  weight = 1,
): FileEdge {
  return { id, from, to, kind, layer: "structural", weight };
}

function makeGraph(files: FileNode[], edges: FileEdge[] = []): WorkspaceGraph {
  return { files, fileEdges: edges, comments: [] };
}

const VIEWPORT = { width: 1600, height: 1000 };

// ── 1. Empty tree / centerId not found ───────────────────────────────

describe("buildBlastLayout — centerId not in tree", () => {
  it("returns empty rings when centerId is absent from the tree", () => {
    const files = [makeFile("pkg/a.ts")];
    const tree = buildEntityTree(makeGraph(files));
    const layout = buildBlastLayout({
      tree,
      graph: makeGraph(files),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      centerId: "does-not-exist",
    });
    expect(layout.rings).toHaveLength(0);
    expect(layout.totalAffected).toBe(0);
    expect(layout.overflow).toBe(0);
  });

  it("returns empty rings for an empty workspace", () => {
    const tree = buildEntityTree(makeGraph([]));
    const layout = buildBlastLayout({
      tree,
      graph: makeGraph([]),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      centerId: "anything",
    });
    expect(layout.rings).toHaveLength(0);
  });
});

// ── 2. File with 1 direct dependent → 1 ring, 1 node ────────────────

describe("buildBlastLayout — single direct dependent", () => {
  it("produces exactly one ring with one node", () => {
    const files = [makeFile("pkg/a.ts"), makeFile("pkg/b.ts")];
    // b depends on a → blast from a should show b in ring 1
    const edges = [makeEdge("e1", "pkg/a.ts", "pkg/b.ts")];
    const graph = makeGraph(files, edges);
    const tree = buildEntityTree(graph);

    const layout = buildBlastLayout({
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      centerId: "pkg/a.ts",
      direction: "blast",
    });

    expect(layout.rings).toHaveLength(1);
    expect(layout.rings[0]!.depth).toBe(1);
    expect(layout.rings[0]!.nodes).toHaveLength(1);
    expect(layout.rings[0]!.nodes[0]!.id).toBe("pkg/b.ts");
    expect(layout.totalAffected).toBe(1);
  });
});

// ── 3. Transitive chain A→B→C with root A → 2 rings ─────────────────

describe("buildBlastLayout — transitive chain", () => {
  it("creates two rings for A→B→C blast from A", () => {
    const files = [makeFile("pkg/a.ts"), makeFile("pkg/b.ts"), makeFile("pkg/c.ts")];
    const edges = [
      makeEdge("e1", "pkg/a.ts", "pkg/b.ts"),
      makeEdge("e2", "pkg/b.ts", "pkg/c.ts"),
    ];
    const graph = makeGraph(files, edges);
    const tree = buildEntityTree(graph);

    const layout = buildBlastLayout({
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      centerId: "pkg/a.ts",
      direction: "blast",
    });

    expect(layout.rings).toHaveLength(2);

    const ring1 = layout.rings.find(r => r.depth === 1);
    const ring2 = layout.rings.find(r => r.depth === 2);
    expect(ring1).toBeDefined();
    expect(ring2).toBeDefined();

    expect(ring1!.nodes.map(n => n.id)).toContain("pkg/b.ts");
    expect(ring2!.nodes.map(n => n.id)).toContain("pkg/c.ts");

    expect(layout.totalAffected).toBe(2);
  });
});

// ── 4. maxNodesPerRing trim → overflow correct ────────────────────────

describe("buildBlastLayout — maxNodesPerRing trim", () => {
  it("trims nodes and records overflow correctly", () => {
    // Create a center with 5 direct dependents; cap at 3
    const files = [
      makeFile("root/root.ts"),
      makeFile("root/dep1.ts"),
      makeFile("root/dep2.ts"),
      makeFile("root/dep3.ts"),
      makeFile("root/dep4.ts"),
      makeFile("root/dep5.ts"),
    ];
    const edges = [
      makeEdge("e1", "root/root.ts", "root/dep1.ts"),
      makeEdge("e2", "root/root.ts", "root/dep2.ts"),
      makeEdge("e3", "root/root.ts", "root/dep3.ts"),
      makeEdge("e4", "root/root.ts", "root/dep4.ts"),
      makeEdge("e5", "root/root.ts", "root/dep5.ts"),
    ];
    const graph = makeGraph(files, edges);
    const tree = buildEntityTree(graph);

    const layout = buildBlastLayout({
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      centerId: "root/root.ts",
      direction: "blast",
      maxNodesPerRing: 3,
    });

    expect(layout.rings).toHaveLength(1);
    expect(layout.rings[0]!.nodes).toHaveLength(3);
    expect(layout.overflow).toBe(2);
    expect(layout.totalAffected).toBe(3); // only the trimmed count
  });
});

// ── 5. Fix direction reverses edge direction ──────────────────────────

describe("buildBlastLayout — fix direction", () => {
  it("fix mode shows callers (what stabilizes when you fix this file)", () => {
    // A imports B → blast from B shows A (B's change breaks A)
    //              → fix from B shows A (fixing B stabilizes A)
    // In fix mode: we follow edges BACKWARD from root, so A→B means
    // B is a dependency of A. Fix from B: who depends on B? = A.
    const files = [makeFile("pkg/a.ts"), makeFile("pkg/b.ts"), makeFile("pkg/c.ts")];
    const edges = [
      makeEdge("e1", "pkg/a.ts", "pkg/b.ts"), // A depends on B
      makeEdge("e2", "pkg/b.ts", "pkg/c.ts"), // B depends on C
    ];
    const graph = makeGraph(files, edges);
    const tree = buildEntityTree(graph);

    // Fix from C: who depends on C? → B (depth 1), A (depth 2)
    const fixLayout = buildBlastLayout({
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      centerId: "pkg/c.ts",
      direction: "fix",
    });

    // fix follows edges backward: C←B←A
    const allNodeIds = fixLayout.rings.flatMap(r => r.nodes.map(n => n.id));
    expect(allNodeIds).toContain("pkg/b.ts");
    expect(allNodeIds).toContain("pkg/a.ts");

    // Blast from C: who does C break? → nobody (C has no dependents)
    const blastLayout = buildBlastLayout({
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      centerId: "pkg/c.ts",
      direction: "blast",
    });

    // C is a leaf in the import graph — nothing depends on it
    expect(blastLayout.rings).toHaveLength(0);
    expect(blastLayout.totalAffected).toBe(0);

    // Sanity: fix and blast from the same node have different results
    expect(fixLayout.rings.length).toBeGreaterThan(0);
  });
});
