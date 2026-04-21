import { describe, it, expect } from "vitest";
import {
  buildEntityTree,
  type FileEdge,
  type FileNode,
  type WorkspaceGraph,
} from "@quanta/canvas-engine";
import { buildChordLayout } from "./build-chord-layout";
import { bundlePathD } from "../lib/edge-bundling";

// ─────────────────────────────────────────────────────────────────────
// Test helpers — mirror the mind-map tests for consistency.

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

const VIEWPORT = { width: 1600, height: 1000 };

// ─────────────────────────────────────────────────────────────────────

describe("buildChordLayout — empty workspace", () => {
  it("returns an empty layout for a workspace with no files", () => {
    const tree = buildEntityTree(makeGraph([]));
    const layout = buildChordLayout({
      tree,
      graph: makeGraph([]),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(layout.groups).toHaveLength(0);
    expect(layout.leaves).toHaveLength(0);
    expect(layout.edges).toHaveLength(0);
  });
});

describe("buildChordLayout — single file", () => {
  it("emits one group and one leaf when there's a single file with no imports", () => {
    const files = [makeFile("pkg/only.ts")];
    const tree = buildEntityTree(makeGraph(files));
    const layout = buildChordLayout({
      tree,
      graph: makeGraph(files),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      leafKind: "building",
    });
    expect(layout.groups).toHaveLength(1);
    expect(layout.leaves).toHaveLength(1);
    expect(layout.edges).toHaveLength(0);
    // The single leaf sits at innerRadius from origin.
    const leaf = layout.leaves[0]!;
    const r = Math.sqrt(leaf.x * leaf.x + leaf.y * leaf.y);
    expect(r).toBeCloseTo(layout.innerRadius, 5);
    // pathFromRoot is [root, hub, leaf] — MVP contract.
    expect(leaf.pathFromRoot).toHaveLength(3);
    expect(leaf.pathFromRoot[0]).toEqual({ x: 0, y: 0 });
  });
});

describe("buildChordLayout — two packages with cross-imports", () => {
  const files = [
    makeFile("pkgA/a1.ts"),
    makeFile("pkgA/a2.ts"),
    makeFile("pkgB/b1.ts"),
    makeFile("pkgB/b2.ts"),
  ];
  const edges = [
    makeEdge("e1", "pkgA/a1.ts", "pkgB/b1.ts"),
    makeEdge("e2", "pkgB/b2.ts", "pkgA/a2.ts"),
  ];
  const tree = buildEntityTree(makeGraph(files, edges));

  it("produces two groups, four leaves, two edges", () => {
    const layout = buildChordLayout({
      tree,
      graph: makeGraph(files, edges),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      leafKind: "building",
    });
    expect(layout.groups).toHaveLength(2);
    expect(layout.leaves).toHaveLength(4);
    expect(layout.edges).toHaveLength(2);
    // Every leaf's groupId points to a real group.
    const groupIds = new Set(layout.groups.map(g => g.id));
    for (const leaf of layout.leaves) {
      expect(groupIds.has(leaf.groupId)).toBe(true);
    }
    // Every edge's endpoints exist in the leaf set.
    const leafIds = new Set(layout.leaves.map(l => l.id));
    for (const e of layout.edges) {
      expect(leafIds.has(e.fromId)).toBe(true);
      expect(leafIds.has(e.toId)).toBe(true);
    }
  });

  it("pathFromRoot contains the shared root (LCA) for cross-package imports", () => {
    const layout = buildChordLayout({
      tree,
      graph: makeGraph(files, edges),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      leafKind: "building",
    });
    // Every leaf's path starts at origin (the universe root / shared
    // ancestor), so a bundled edge between any two leaves passes
    // through origin by construction.
    for (const leaf of layout.leaves) {
      expect(leaf.pathFromRoot[0]).toEqual({ x: 0, y: 0 });
    }
    // Find two leaves from different groups and confirm their group
    // hubs differ (so the bundle actually threads through two hubs).
    const a1 = layout.leaves.find(l => l.id === "pkgA/a1.ts")!;
    const b1 = layout.leaves.find(l => l.id === "pkgB/b1.ts")!;
    expect(a1.groupId).not.toBe(b1.groupId);
    expect(a1.pathFromRoot[1]).not.toEqual(b1.pathFromRoot[1]);
  });
});

describe("buildChordLayout — determinism", () => {
  it("produces bit-identical output for identical input", () => {
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
    ];
    const tree = buildEntityTree(makeGraph(files, edges));
    const opts = {
      tree,
      graph: makeGraph(files, edges),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      leafKind: "building" as const,
    };
    const a = buildChordLayout(opts);
    const b = buildChordLayout(opts);
    expect(a).toEqual(b);
  });
});

describe("buildChordLayout — scopeId filter", () => {
  it("includes only leaves under scopeId when set", () => {
    const files = [
      makeFile("pkgA/a1.ts"),
      makeFile("pkgA/a2.ts"),
      makeFile("pkgB/b1.ts"),
    ];
    const edges = [makeEdge("e1", "pkgA/a1.ts", "pkgB/b1.ts")];
    const tree = buildEntityTree(makeGraph(files, edges));
    // Find the galaxy id for pkgA.
    const galaxies = tree.byKind("galaxy");
    const pkgA = galaxies.find(g => g.name === "pkgA");
    expect(pkgA).toBeDefined();
    const layout = buildChordLayout({
      tree,
      graph: makeGraph(files, edges),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      scopeId: pkgA!.id,
      leafKind: "building",
    });
    // Only a1 and a2 show up as leaves.
    const leafIds = layout.leaves.map(l => l.id).sort();
    expect(leafIds).toEqual(["pkgA/a1.ts", "pkgA/a2.ts"]);
    // Edge to pkgB is dropped because pkgB/b1.ts isn't in the leaf set.
    expect(layout.edges).toHaveLength(0);
  });

  it("throws when scopeId is not in the tree", () => {
    const files = [makeFile("pkg/a.ts")];
    const tree = buildEntityTree(makeGraph(files));
    expect(() =>
      buildChordLayout({
        tree,
        graph: makeGraph(files),
        width: VIEWPORT.width,
        height: VIEWPORT.height,
        scopeId: "does-not-exist",
      }),
    ).toThrow(/scopeId "does-not-exist" not found in tree/);
  });
});

describe("buildChordLayout — phantom edges dropped", () => {
  it("drops edges whose endpoints are not in the leaf set", () => {
    const files = [makeFile("pkg/a.ts")];
    const edges = [makeEdge("phantom", "ghost.ts", "pkg/a.ts")];
    const tree = buildEntityTree(makeGraph(files));
    const layout = buildChordLayout({
      tree,
      graph: makeGraph(files, edges),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      leafKind: "building",
    });
    expect(layout.edges).toHaveLength(0);
  });
});

describe("buildChordLayout — group leafIds match angular order", () => {
  it("leafIds on a group equal the angular-sorted leaf ids under that group", () => {
    const files = [
      makeFile("pkg/c.ts"),
      makeFile("pkg/a.ts"),
      makeFile("pkg/b.ts"),
    ];
    const tree = buildEntityTree(makeGraph(files));
    const layout = buildChordLayout({
      tree,
      graph: makeGraph(files),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      leafKind: "building",
    });
    expect(layout.groups).toHaveLength(1);
    const g = layout.groups[0]!;
    // Sorted by name asc: a, b, c.
    expect(g.leafIds).toEqual(["pkg/a.ts", "pkg/b.ts", "pkg/c.ts"]);
  });
});

describe("buildChordLayout — galaxy-level default (package coupling)", () => {
  it("aggregates file edges to galaxy-to-galaxy ribbons by default", () => {
    const files = [
      makeFile("pkgA/a1.ts"),
      makeFile("pkgA/a2.ts"),
      makeFile("pkgB/b1.ts"),
      makeFile("pkgB/b2.ts"),
    ];
    const edges = [
      // 3 imports A→B, should collapse into ONE ribbon with weight=3
      makeEdge("e1", "pkgA/a1.ts", "pkgB/b1.ts"),
      makeEdge("e2", "pkgA/a1.ts", "pkgB/b2.ts"),
      makeEdge("e3", "pkgA/a2.ts", "pkgB/b1.ts"),
      // Intra-package edge — should NOT appear in the chord
      makeEdge("e4", "pkgA/a1.ts", "pkgA/a2.ts"),
    ];
    const tree = buildEntityTree(makeGraph(files, edges));
    const layout = buildChordLayout({
      tree,
      graph: makeGraph(files, edges),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      // leafKind omitted — default is "galaxy"
    });
    // Two galaxies → two leaves + two groups (each its own arc).
    expect(layout.leaves).toHaveLength(2);
    expect(layout.groups).toHaveLength(2);
    const galaxyIds = layout.leaves.map(l => l.id).sort();
    // Leaf ids are galaxy ids, not file ids.
    for (const id of galaxyIds) {
      expect(id.startsWith("galaxy:")).toBe(true);
    }
    // Exactly one ribbon — A → B, intra-A edge dropped.
    expect(layout.edges).toHaveLength(1);
    const ribbon = layout.edges[0]!;
    expect(ribbon.weight).toBe(3); // three file imports rolled up
  });

  it("drops edges whose endpoints don't roll up to a galaxy", () => {
    const files = [makeFile("pkg/a.ts")];
    const edges = [makeEdge("phantom", "ghost.ts", "pkg/a.ts")];
    const tree = buildEntityTree(makeGraph(files, edges));
    const layout = buildChordLayout({
      tree,
      graph: makeGraph(files, edges),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(layout.edges).toHaveLength(0);
  });
});

// ─────────────────────────────────────────────────────────────────────
// bundlePathD — edge-bundling smoke tests.

describe("bundlePathD — degenerate cases", () => {
  it("returns '' for empty paths", () => {
    expect(bundlePathD({ fromPath: [], toPath: [] })).toBe("");
    expect(bundlePathD({ fromPath: [{ x: 0, y: 0 }], toPath: [] })).toBe("");
  });

  it("returns '' when from and to leaves are within 1 px", () => {
    const root = { x: 0, y: 0 };
    const leaf = { x: 100.2, y: 100.2 };
    const leafNear = { x: 100.5, y: 100.5 };
    const d = bundlePathD({
      fromPath: [root, leaf],
      toPath: [root, leafNear],
    });
    expect(d).toBe("");
  });
});

describe("bundlePathD — beta mapping", () => {
  const root = { x: 0, y: 0 };
  const fromHub = { x: -50, y: 0 };
  const toHub = { x: 50, y: 0 };
  const fromLeaf = { x: -200, y: 100 };
  const toLeaf = { x: 200, y: 100 };
  const fromPath = [root, fromHub, fromLeaf];
  const toPath = [root, toHub, toLeaf];

  it("produces a valid SVG path string starting with M", () => {
    const d = bundlePathD({ fromPath, toPath, beta: 0.85 });
    expect(d).toMatch(/^M /);
    expect(d).toContain(" L ");
  });

  it("beta=0 approximates a straight line between endpoints", () => {
    // With beta=0 the interior control points collapse onto the
    // straight line, so every sample should be on the from→to line
    // (within float tolerance for spline sampling).
    const d = bundlePathD({ fromPath, toPath, beta: 0, steps: 16 });
    expect(d).not.toBe("");
    // Extract the x/y samples and check they all lie near the from→to
    // straight line — the max perpendicular distance should be small.
    const samples = parsePathD(d);
    expect(samples.length).toBeGreaterThan(2);
    let maxDev = 0;
    for (const p of samples) {
      const dev = pointToLineDist(p, fromLeaf, toLeaf);
      if (dev > maxDev) maxDev = dev;
    }
    // With a CR spline through straightened controls the deviation is
    // only numerical, not semantic — bounded well below 1 px.
    expect(maxDev).toBeLessThan(1);
  });

  it("beta=1 hugs the hierarchy path (deviates meaningfully from the straight line)", () => {
    const d = bundlePathD({ fromPath, toPath, beta: 1, steps: 16 });
    const samples = parsePathD(d);
    let maxDev = 0;
    for (const p of samples) {
      const dev = pointToLineDist(p, fromLeaf, toLeaf);
      if (dev > maxDev) maxDev = dev;
    }
    // The hierarchy path pulls the midsection down to y=0; the
    // straight line passes through y=100. Deviation is at least tens
    // of pixels.
    expect(maxDev).toBeGreaterThan(30);
  });

  it("beta is deterministic across calls", () => {
    const d1 = bundlePathD({ fromPath, toPath, beta: 0.85 });
    const d2 = bundlePathD({ fromPath, toPath, beta: 0.85 });
    expect(d1).toBe(d2);
  });
});

// ─────────────────────────────────────────────────────────────────────
// Helpers (test-only)

function parsePathD(d: string): { x: number; y: number }[] {
  // Parses "M x y L x y L x y ..." — the exact format bundlePathD emits.
  const out: { x: number; y: number }[] = [];
  const tokens = d.split(/\s+/);
  let i = 0;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === "M" || t === "L") {
      const x = Number(tokens[i + 1]);
      const y = Number(tokens[i + 2]);
      out.push({ x, y });
      i += 3;
    } else {
      i += 1;
    }
  }
  return out;
}

function pointToLineDist(p: { x: number; y: number }, a: { x: number; y: number }, b: { x: number; y: number }): number {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const len = Math.sqrt(dx * dx + dy * dy);
  if (len === 0) return Math.sqrt((p.x - a.x) ** 2 + (p.y - a.y) ** 2);
  const cross = (p.x - a.x) * dy - (p.y - a.y) * dx;
  return Math.abs(cross) / len;
}
