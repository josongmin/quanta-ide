import { describe, it, expect } from "vitest";
import {
  buildEntityTree,
  type FileEdge,
  type FileNode,
  type WorkspaceGraph,
} from "@quanta/canvas-engine";
import { buildMatrixLayout } from "./build-matrix-layout";

// ─────────────────────────────────────────────────────────────────────
// Test helpers — same shape as the chord-view tests so the two files
// read side-by-side cleanly.

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
): FileEdge {
  return { id, from, to, kind, layer: "structural", weight: 1 };
}

function makeGraph(files: FileNode[], edges: FileEdge[] = []): WorkspaceGraph {
  return { files, fileEdges: edges, comments: [] };
}

const VIEWPORT = { width: 1600, height: 1000 };

// ─────────────────────────────────────────────────────────────────────

describe("buildMatrixLayout — empty workspace", () => {
  it("returns an empty layout for a graph with no files", () => {
    const tree = buildEntityTree(makeGraph([]));
    const layout = buildMatrixLayout({
      tree,
      graph: makeGraph([]),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(layout.rows).toHaveLength(0);
    expect(layout.cells).toHaveLength(0);
    expect(layout.overflow).toBe(0);
    expect(layout.groupBoundaries).toHaveLength(0);
  });
});

describe("buildMatrixLayout — single file", () => {
  it("emits one row and zero cells when there's a single file with no imports", () => {
    const files = [makeFile("pkg/only.ts")];
    const tree = buildEntityTree(makeGraph(files));
    const layout = buildMatrixLayout({
      tree,
      graph: makeGraph(files),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(layout.rows).toHaveLength(1);
    expect(layout.cells).toHaveLength(0);
    expect(layout.overflow).toBe(0);
    // First row always sits at index 0.
    expect(layout.rows[0]?.index).toBe(0);
    // Group boundaries start at 0 and contain just the first row.
    expect(layout.groupBoundaries).toEqual([0]);
  });
});

describe("buildMatrixLayout — crossGroup flag", () => {
  it("marks cells across different packages as crossGroup", () => {
    const files = [
      makeFile("pkgA/a1.ts"),
      makeFile("pkgA/a2.ts"),
      makeFile("pkgB/b1.ts"),
    ];
    // An intra-pkg edge (pkgA/a1 → pkgA/a2) + a cross-pkg edge
    // (pkgA/a1 → pkgB/b1). The former should NOT be crossGroup;
    // the latter SHOULD.
    const edges = [
      makeEdge("e1", "pkgA/a1.ts", "pkgA/a2.ts"),
      makeEdge("e2", "pkgA/a1.ts", "pkgB/b1.ts"),
    ];
    const tree = buildEntityTree(makeGraph(files, edges));
    const layout = buildMatrixLayout({
      tree,
      graph: makeGraph(files, edges),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });

    const intra = layout.cells.find(
      c => c.fromId === "pkgA/a1.ts" && c.toId === "pkgA/a2.ts",
    );
    const cross = layout.cells.find(
      c => c.fromId === "pkgA/a1.ts" && c.toId === "pkgB/b1.ts",
    );
    expect(intra?.crossGroup).toBe(false);
    expect(cross?.crossGroup).toBe(true);
  });
});

describe("buildMatrixLayout — bidirectional flag", () => {
  it("marks both A→B and B→A as bidirectional when the reverse edge exists", () => {
    const files = [makeFile("pkg/a.ts"), makeFile("pkg/b.ts")];
    const edges = [
      makeEdge("e1", "pkg/a.ts", "pkg/b.ts"),
      makeEdge("e2", "pkg/b.ts", "pkg/a.ts"),
    ];
    const tree = buildEntityTree(makeGraph(files, edges));
    const layout = buildMatrixLayout({
      tree,
      graph: makeGraph(files, edges),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(layout.cells).toHaveLength(2);
    for (const cell of layout.cells) {
      expect(cell.bidirectional).toBe(true);
    }
  });

  it("does NOT mark one-way edges as bidirectional", () => {
    const files = [makeFile("pkg/a.ts"), makeFile("pkg/b.ts")];
    const edges = [makeEdge("e1", "pkg/a.ts", "pkg/b.ts")];
    const tree = buildEntityTree(makeGraph(files, edges));
    const layout = buildMatrixLayout({
      tree,
      graph: makeGraph(files, edges),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(layout.cells).toHaveLength(1);
    expect(layout.cells[0]?.bidirectional).toBe(false);
  });
});

describe("buildMatrixLayout — maxRows overflow", () => {
  it("drops low-connectivity rows and reports overflow when 300 files + maxRows=100", () => {
    // 100 high-connectivity files that all import from pkg/hub.ts,
    // plus 200 orphan files with no edges. The 100 connected files
    // (plus the hub) must survive the maxRows=100 cap; the orphans
    // get dropped with overflow=200.
    const files: FileNode[] = [];
    const edges: FileEdge[] = [];
    files.push(makeFile("pkg/hub.ts"));
    for (let i = 0; i < 99; i++) {
      const id = `pkg/connected-${String(i).padStart(3, "0")}.ts`;
      files.push(makeFile(id));
      edges.push(makeEdge(`e-conn-${i}`, id, "pkg/hub.ts"));
    }
    for (let i = 0; i < 200; i++) {
      files.push(makeFile(`pkg/orphan-${String(i).padStart(3, "0")}.ts`));
    }
    expect(files).toHaveLength(300);

    const tree = buildEntityTree(makeGraph(files, edges));
    const layout = buildMatrixLayout({
      tree,
      graph: makeGraph(files, edges),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      maxRows: 100,
    });

    expect(layout.rows).toHaveLength(100);
    expect(layout.overflow).toBe(200);

    // Hub stays — it's the highest-degree row in the graph.
    const ids = new Set(layout.rows.map(r => r.id));
    expect(ids.has("pkg/hub.ts")).toBe(true);
    // None of the orphans survive.
    for (const r of layout.rows) {
      expect(r.id).not.toContain("orphan-");
    }
  });
});

describe("buildMatrixLayout — determinism", () => {
  it("produces structurally identical output across repeat runs on the same input", () => {
    const files = [
      makeFile("pkg1/a.ts"),
      makeFile("pkg1/b.ts"),
      makeFile("pkg2/c.ts"),
      makeFile("pkg2/d.ts"),
      makeFile("pkg3/e.ts"),
    ];
    const edges = [
      makeEdge("e1", "pkg1/a.ts", "pkg2/c.ts"),
      makeEdge("e2", "pkg2/d.ts", "pkg3/e.ts"),
      makeEdge("e3", "pkg3/e.ts", "pkg1/b.ts"),
      makeEdge("e4", "pkg1/a.ts", "pkg1/b.ts"),
    ];
    const tree = buildEntityTree(makeGraph(files, edges));
    const opts = {
      tree,
      graph: makeGraph(files, edges),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    };
    const a = buildMatrixLayout(opts);
    const b = buildMatrixLayout(opts);

    expect(a.rows.map(r => r.id)).toEqual(b.rows.map(r => r.id));
    expect(a.cells.map(c => c.id)).toEqual(b.cells.map(c => c.id));
    expect(a.cellSize).toBe(b.cellSize);
    expect(a.labelGutter).toBe(b.labelGutter);
    expect(a.overflow).toBe(b.overflow);
    expect(a.groupBoundaries).toEqual(b.groupBoundaries);
  });
});

describe("buildMatrixLayout — clustering pushes coupled rows adjacent", () => {
  it("six entities split into two tight cliques land as contiguous blocks", () => {
    // Two cliques of 3: { a1, a2, a3 } and { b1, b2, b3 }. Every
    // intra-clique pair has an edge; zero inter-clique edges. A
    // working clustering must put a1/a2/a3 in consecutive positions
    // and b1/b2/b3 in consecutive positions.
    const files = [
      makeFile("pkg/a1.ts"),
      makeFile("pkg/a2.ts"),
      makeFile("pkg/a3.ts"),
      makeFile("pkg/b1.ts"),
      makeFile("pkg/b2.ts"),
      makeFile("pkg/b3.ts"),
    ];
    // All six files live in one package so group clustering is
    // trivial — this test pressures the within-group greedy order.
    const aIds = ["pkg/a1.ts", "pkg/a2.ts", "pkg/a3.ts"];
    const bIds = ["pkg/b1.ts", "pkg/b2.ts", "pkg/b3.ts"];
    const edges: FileEdge[] = [];
    let k = 0;
    for (const a of aIds) {
      for (const other of aIds) {
        if (a === other) continue;
        edges.push(makeEdge(`ea-${k++}`, a, other));
      }
    }
    for (const b of bIds) {
      for (const other of bIds) {
        if (b === other) continue;
        edges.push(makeEdge(`eb-${k++}`, b, other));
      }
    }
    const tree = buildEntityTree(makeGraph(files, edges));
    const layout = buildMatrixLayout({
      tree,
      graph: makeGraph(files, edges),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });

    const order = layout.rows.map(r => r.id);
    const aIndices = aIds.map(id => order.indexOf(id)).sort((x, y) => x - y);
    const bIndices = bIds.map(id => order.indexOf(id)).sort((x, y) => x - y);

    // Contiguous run = max - min === size - 1.
    expect(aIndices[2]! - aIndices[0]!).toBe(2);
    expect(bIndices[2]! - bIndices[0]!).toBe(2);
  });
});

describe("buildMatrixLayout — scopeId filter", () => {
  it("restricts rows to entities under the scope", () => {
    const files = [
      makeFile("pkgA/a1.ts"),
      makeFile("pkgA/a2.ts"),
      makeFile("pkgB/b1.ts"),
    ];
    const edges = [makeEdge("e1", "pkgA/a1.ts", "pkgB/b1.ts")];
    const tree = buildEntityTree(makeGraph(files, edges));
    const pkgA = tree.byKind("galaxy").find(g => g.name === "pkgA");
    expect(pkgA).toBeDefined();

    const layout = buildMatrixLayout({
      tree,
      graph: makeGraph(files, edges),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      scopeId: pkgA!.id,
    });

    const rowIds = layout.rows.map(r => r.id).sort();
    expect(rowIds).toEqual(["pkgA/a1.ts", "pkgA/a2.ts"]);
    // Edge to pkgB dropped because pkgB/b1.ts is outside the scope.
    expect(layout.cells).toHaveLength(0);
  });

  it("throws when scopeId is not in the tree", () => {
    const files = [makeFile("pkg/a.ts")];
    const tree = buildEntityTree(makeGraph(files));
    expect(() =>
      buildMatrixLayout({
        tree,
        graph: makeGraph(files),
        width: VIEWPORT.width,
        height: VIEWPORT.height,
        scopeId: "does-not-exist",
      }),
    ).toThrow(/scopeId "does-not-exist" not found in tree/);
  });
});

describe("buildMatrixLayout — cell positions match row ordering", () => {
  it("every cell's (row,col) matches the indices of its endpoints in `rows`", () => {
    const files = [
      makeFile("pkg/a.ts"),
      makeFile("pkg/b.ts"),
      makeFile("pkg/c.ts"),
    ];
    const edges = [
      makeEdge("e1", "pkg/a.ts", "pkg/b.ts"),
      makeEdge("e2", "pkg/c.ts", "pkg/a.ts"),
    ];
    const tree = buildEntityTree(makeGraph(files, edges));
    const layout = buildMatrixLayout({
      tree,
      graph: makeGraph(files, edges),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });

    const indexOf = new Map<string, number>();
    for (const r of layout.rows) indexOf.set(r.id, r.index);

    for (const cell of layout.cells) {
      expect(cell.row).toBe(indexOf.get(cell.fromId));
      expect(cell.col).toBe(indexOf.get(cell.toId));
    }
  });
});

describe("buildMatrixLayout — weight aggregation", () => {
  it("accumulates weights when multiple FileEdges connect the same pair", () => {
    const files = [makeFile("pkg/a.ts"), makeFile("pkg/b.ts")];
    const edges = [
      { ...makeEdge("e1", "pkg/a.ts", "pkg/b.ts"), weight: 2 },
      { ...makeEdge("e2", "pkg/a.ts", "pkg/b.ts", "call"), weight: 3 },
    ];
    const tree = buildEntityTree(makeGraph(files, edges));
    const layout = buildMatrixLayout({
      tree,
      graph: makeGraph(files, edges),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(layout.cells).toHaveLength(1);
    expect(layout.cells[0]?.weight).toBe(5);
  });
});

describe("buildMatrixLayout — self-loops dropped", () => {
  it("drops edges that point from a row to itself (not a DSM cell)", () => {
    const files = [makeFile("pkg/a.ts")];
    const edges = [makeEdge("e1", "pkg/a.ts", "pkg/a.ts")];
    const tree = buildEntityTree(makeGraph(files, edges));
    const layout = buildMatrixLayout({
      tree,
      graph: makeGraph(files, edges),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(layout.rows).toHaveLength(1);
    expect(layout.cells).toHaveLength(0);
  });
});
