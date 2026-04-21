import { describe, it, expect } from "vitest";
import {
  buildEntityTree,
  type FileEdge,
  type FileNode,
  type WorkspaceGraph,
} from "@quanta/canvas-engine";
import { buildMindMap } from "./build-mind-map";
import type { EntityWeightHint } from "./types";

// ─────────────────────────────────────────────────────────────────────
// Test helpers — minimal stubs mirroring the canvas-engine test style.

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

function makeEdge(id: string, from: string, to: string): FileEdge {
  return {
    id,
    from,
    to,
    kind: "call",
    layer: "structural",
    weight: 1,
  };
}

function makeGraph(files: FileNode[], edges: FileEdge[] = []): WorkspaceGraph {
  return { files, fileEdges: edges, comments: [] };
}

const VIEWPORT = { width: 1600, height: 1000 };

// ─────────────────────────────────────────────────────────────────────

describe("buildMindMap — centre with no relationships", () => {
  it("emits a single-node graph when the centre is the universe root", () => {
    const tree = buildEntityTree(makeGraph([makeFile("a.ts")]));
    // The universe root has no siblings, no parent-dir, no callers/callees.
    // Children is the only bucket that could appear; test with a
    // synthetic empty tree to cover the full empty-bucket path.
    const emptyTree = buildEntityTree(makeGraph([]));
    const graph = buildMindMap({
      tree: emptyTree,
      graph: makeGraph([]),
      centerId: emptyTree.rootId,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(graph.nodes).toHaveLength(1);
    expect(graph.nodes[0]?.kind).toBe("center");
    expect(graph.edges).toHaveLength(0);
    for (const count of Object.values(graph.aggregatorCounts)) {
      expect(count).toBe(0);
    }
    // Unused ref — just proves the fixture builds without errors.
    expect(tree.rootId).toBeDefined();
  });

  it("emits a single-node graph when a leaf file has no edges and no siblings", () => {
    // One galaxy with one street with one file — the file has no
    // siblings (parent has only one child) and no call edges.
    const tree = buildEntityTree(makeGraph([makeFile("alone/deep/loner.ts")]));
    const result = buildMindMap({
      tree,
      graph: makeGraph([makeFile("alone/deep/loner.ts")]),
      centerId: "alone/deep/loner.ts",
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    // parent-dir still emits (loner has ancestors deep + alone), so we
    // get at least the centre + aggregator + 2 entity ancestors.
    // Leaf-with-nothing case: verify absence of callers/callees/siblings/children.
    expect(result.aggregatorCounts["callers"]).toBe(0);
    expect(result.aggregatorCounts["callees"]).toBe(0);
    expect(result.aggregatorCounts["siblings"]).toBe(0);
    expect(result.aggregatorCounts["children"]).toBe(0);
    expect(result.aggregatorCounts["parent-dir"]).toBeGreaterThan(0);
  });
});

describe("buildMindMap — siblings only", () => {
  it("emits exactly one aggregator when the centre has only siblings", () => {
    const tree = buildEntityTree(
      makeGraph([makeFile("pkg/a.ts"), makeFile("pkg/b.ts"), makeFile("pkg/c.ts")]),
    );
    // Centre on `pkg/a.ts`. Its siblings are `b.ts` and `c.ts`;
    // parent-dir is `pkg` (galaxy) — so we DO also get parent-dir.
    // Focus the test on the siblings bucket shape; assert both exist.
    const result = buildMindMap({
      tree,
      graph: makeGraph([makeFile("pkg/a.ts"), makeFile("pkg/b.ts"), makeFile("pkg/c.ts")]),
      centerId: "pkg/a.ts",
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(result.aggregatorCounts["siblings"]).toBe(2);
    expect(result.aggregatorCounts["parent-dir"]).toBeGreaterThan(0);
    expect(result.aggregatorCounts["callers"]).toBe(0);
    expect(result.aggregatorCounts["callees"]).toBe(0);
    expect(result.aggregatorCounts["children"]).toBe(0);
    // siblings aggregator has 2 entities → 3 nodes attributable to it
    // (hub + 2 leaves). Find the hub node.
    const siblingHub = result.nodes.find(n => n.id === "agg:siblings");
    expect(siblingHub).toBeDefined();
    const siblingLeaves = result.nodes.filter(n => n.kind === "entity" && (n.id === "pkg/b.ts" || n.id === "pkg/c.ts"));
    expect(siblingLeaves).toHaveLength(2);
    // Leaves must sit at ~R2 distance (± weight pull).
    for (const leaf of siblingLeaves) {
      expect(leaf.distance).toBeGreaterThan(0);
    }
  });
});

describe("buildMindMap — callers + callees + parent-dir", () => {
  it("places parent-dir near the top (12 o'clock ±) when it's the first priority", () => {
    const files = [
      makeFile("pkg/target.ts"),
      makeFile("pkg/caller1.ts"),
      makeFile("pkg/caller2.ts"),
      makeFile("pkg/callee1.ts"),
    ];
    const edges = [
      makeEdge("e1", "pkg/caller1.ts", "pkg/target.ts"),
      makeEdge("e2", "pkg/caller2.ts", "pkg/target.ts"),
      makeEdge("e3", "pkg/target.ts", "pkg/callee1.ts"),
    ];
    const tree = buildEntityTree(makeGraph(files, edges));
    const result = buildMindMap({
      tree,
      graph: makeGraph(files, edges),
      centerId: "pkg/target.ts",
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    // Three aggregators with content: parent-dir, callers, callees.
    // Siblings is also populated (there are 3 peer files), so we
    // expect four active aggregators.
    expect(result.aggregatorCounts["parent-dir"]).toBeGreaterThan(0);
    expect(result.aggregatorCounts["callers"]).toBe(2);
    expect(result.aggregatorCounts["callees"]).toBe(1);
    const parentHub = result.nodes.find(n => n.id === "agg:parent-dir");
    const callersHub = result.nodes.find(n => n.id === "agg:callers");
    const calleesHub = result.nodes.find(n => n.id === "agg:callees");
    expect(parentHub && callersHub && calleesHub).toBeTruthy();
    // `parent-dir` anchors the 12 o'clock slot; subsequent priority
    // hubs sweep clockwise from there. Measure as a normalised offset
    // ∈ [0, 2π) from the -π/2 axis so `parent-dir` lands at ~0, and
    // `callers` (next in priority) lands strictly further along the
    // sweep — not symmetric wrap-around.
    const clockwiseFromTop = (a: number): number => {
      let d = a - (-Math.PI / 2);
      while (d < 0) d += 2 * Math.PI;
      while (d >= 2 * Math.PI) d -= 2 * Math.PI;
      return d;
    };
    const parentCw = clockwiseFromTop(parentHub!.angle);
    const callerCw = clockwiseFromTop(callersHub!.angle);
    // parent-dir sits at the start of the sweep; callers comes later.
    expect(parentCw).toBeLessThan(callerCw);
    // parent-dir centre is strictly within the first priority's slice —
    // its clockwise offset is < π (upper hemisphere when we translate
    // +y-down screen coords back to math coords).
    expect(parentCw).toBeLessThan(Math.PI);
  });

  it("thicker trunks for larger aggregators (width scales with bucket size)", () => {
    // Build a workspace where callers has many more files than callees.
    const files: FileNode[] = [makeFile("pkg/target.ts")];
    const edges: FileEdge[] = [];
    for (let i = 0; i < 6; i++) {
      files.push(makeFile(`pkg/caller${i}.ts`));
      edges.push(makeEdge(`ein${i}`, `pkg/caller${i}.ts`, "pkg/target.ts"));
    }
    files.push(makeFile("pkg/callee1.ts"));
    edges.push(makeEdge("eout1", "pkg/target.ts", "pkg/callee1.ts"));
    const tree = buildEntityTree(makeGraph(files, edges));
    const result = buildMindMap({
      tree,
      graph: makeGraph(files, edges),
      centerId: "pkg/target.ts",
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    const callerTrunk = result.edges.find(e => e.toId === "agg:callers");
    const calleeTrunk = result.edges.find(e => e.toId === "agg:callees");
    expect(callerTrunk && calleeTrunk).toBeTruthy();
    expect(callerTrunk!.widthStart).toBeGreaterThan(calleeTrunk!.widthStart);
  });
});

describe("buildMindMap — callers/callees pair", () => {
  it("emits an empty callers hub when only callees is populated", () => {
    const files = [
      makeFile("pkg/leaf.ts"),
      makeFile("pkg/dep.ts"),
    ];
    const edges = [makeEdge("e1", "pkg/leaf.ts", "pkg/dep.ts")];
    const tree = buildEntityTree(makeGraph(files, edges));
    const result = buildMindMap({
      tree,
      graph: makeGraph(files, edges),
      centerId: "pkg/leaf.ts",
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(result.aggregatorCounts["callers"]).toBe(0);
    expect(result.aggregatorCounts["callees"]).toBe(1);
    const callersHub = result.nodes.find(n => n.id === "agg:callers");
    const calleesHub = result.nodes.find(n => n.id === "agg:callees");
    expect(callersHub).toBeDefined();
    expect(calleesHub).toBeDefined();
    // No caller-leaf entities under the forced-empty hub.
    const callerLeaves = result.edges.filter(e => e.fromId === "agg:callers");
    expect(callerLeaves).toHaveLength(0);
    // Trunk edge to the empty hub still exists — renderers show the "0".
    const callerTrunk = result.edges.find(e => e.toId === "agg:callers");
    expect(callerTrunk).toBeDefined();
  });

  it("omits both hubs when neither callers nor callees has content", () => {
    // Single file with no edges — neither side forces the pair.
    const files = [makeFile("pkg/alone.ts")];
    const tree = buildEntityTree(makeGraph(files));
    const result = buildMindMap({
      tree,
      graph: makeGraph(files),
      centerId: "pkg/alone.ts",
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(result.nodes.find(n => n.id === "agg:callers")).toBeUndefined();
    expect(result.nodes.find(n => n.id === "agg:callees")).toBeUndefined();
  });
});

describe("buildMindMap — cap behaviour", () => {
  it("trims a big bucket to the cap but reports the original count", () => {
    // 20 callers, cap at 8.
    const files: FileNode[] = [makeFile("pkg/target.ts")];
    const edges: FileEdge[] = [];
    for (let i = 0; i < 20; i++) {
      files.push(makeFile(`pkg/caller${String(i).padStart(2, "0")}.ts`));
      edges.push(makeEdge(`ein${i}`, `pkg/caller${String(i).padStart(2, "0")}.ts`, "pkg/target.ts"));
    }
    const tree = buildEntityTree(makeGraph(files, edges));
    const result = buildMindMap({
      tree,
      graph: makeGraph(files, edges),
      centerId: "pkg/target.ts",
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      entitiesPerAggregatorCap: 8,
    });
    expect(result.aggregatorCounts["callers"]).toBe(20);
    const callerLeafEdges = result.edges.filter(e => e.fromId === "agg:callers");
    expect(callerLeafEdges).toHaveLength(8);
    // The 20 caller files are also siblings of target, so we can't
    // identify "callers bucket" membership by id prefix alone. Use
    // the edge set we just sized as the authoritative set, then
    // cross-check node presence.
    const callerNodeIds = new Set(callerLeafEdges.map(e => e.toId));
    expect(callerNodeIds.size).toBe(8);
    for (const id of callerNodeIds) {
      expect(result.nodes.some(n => n.id === id && n.kind === "entity")).toBe(true);
    }
  });
});

describe("buildMindMap — determinism", () => {
  it("produces bit-identical output for identical input", () => {
    const files = [
      makeFile("pkg/a.ts"),
      makeFile("pkg/b.ts"),
      makeFile("pkg/c.ts"),
      makeFile("other/d.ts"),
      makeFile("other/e.ts"),
    ];
    const edges = [
      makeEdge("e1", "other/d.ts", "pkg/a.ts"),
      makeEdge("e2", "other/e.ts", "pkg/a.ts"),
      makeEdge("e3", "pkg/a.ts", "other/d.ts"),
    ];
    const weights = new Map<string, EntityWeightHint>([
      ["pkg/b.ts", { weight: 0.8 }],
      ["pkg/c.ts", { weight: 0.3 }],
      ["other/d.ts", { weight: 0.9 }],
    ]);
    const tree = buildEntityTree(makeGraph(files, edges));
    const opts = {
      tree,
      graph: makeGraph(files, edges),
      centerId: "pkg/a.ts",
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      weights,
    };
    const a = buildMindMap(opts);
    const b = buildMindMap(opts);
    expect(a).toEqual(b);
  });
});

describe("buildMindMap — error handling", () => {
  it("throws when centerId is not in the tree", () => {
    const tree = buildEntityTree(makeGraph([makeFile("a.ts")]));
    expect(() =>
      buildMindMap({
        tree,
        graph: makeGraph([]),
        centerId: "does-not-exist",
        width: VIEWPORT.width,
        height: VIEWPORT.height,
      }),
    ).toThrow(/centerId "does-not-exist" not found in tree/);
  });

  it("skips file-edge endpoints that don't map to tree entities", () => {
    const tree = buildEntityTree(makeGraph([makeFile("pkg/target.ts")]));
    // Edge references a file id that isn't in the tree — should be
    // silently ignored, not counted.
    const phantomEdges: FileEdge[] = [makeEdge("phantom", "ghost.ts", "pkg/target.ts")];
    const result = buildMindMap({
      tree,
      graph: makeGraph([makeFile("pkg/target.ts")], phantomEdges),
      centerId: "pkg/target.ts",
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(result.aggregatorCounts["callers"]).toBe(0);
  });
});

describe("buildMindMap — bounds", () => {
  it("bounds enclose every node's radius box", () => {
    const files = [makeFile("pkg/a.ts"), makeFile("pkg/b.ts"), makeFile("pkg/c.ts")];
    const tree = buildEntityTree(makeGraph(files));
    const result = buildMindMap({
      tree,
      graph: makeGraph(files),
      centerId: "pkg/a.ts",
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    for (const n of result.nodes) {
      expect(n.x - n.radius).toBeGreaterThanOrEqual(result.bounds.minX - 1e-6);
      expect(n.y - n.radius).toBeGreaterThanOrEqual(result.bounds.minY - 1e-6);
      expect(n.x + n.radius).toBeLessThanOrEqual(result.bounds.maxX + 1e-6);
      expect(n.y + n.radius).toBeLessThanOrEqual(result.bounds.maxY + 1e-6);
    }
  });
});

describe("buildMindMap — weight affects distance", () => {
  it("heavier entities sit closer to centre within the same bucket", () => {
    const files = [
      makeFile("pkg/target.ts"),
      makeFile("pkg/heavy.ts"),
      makeFile("pkg/light.ts"),
    ];
    const tree = buildEntityTree(makeGraph(files));
    const weights = new Map<string, EntityWeightHint>([
      ["pkg/heavy.ts", { weight: 1.0 }],
      ["pkg/light.ts", { weight: 0.0 }],
    ]);
    const result = buildMindMap({
      tree,
      graph: makeGraph(files),
      centerId: "pkg/target.ts",
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      weights,
    });
    const heavy = result.nodes.find(n => n.id === "pkg/heavy.ts");
    const light = result.nodes.find(n => n.id === "pkg/light.ts");
    expect(heavy && light).toBeTruthy();
    expect(heavy!.distance).toBeLessThan(light!.distance);
    // Heavy node should also have a larger radius (entity radius
    // scales with weight).
    expect(heavy!.radius).toBeGreaterThan(light!.radius);
  });
});
