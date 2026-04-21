import { describe, it, expect } from "vitest";
import {
  buildEntityTree,
  type FileEdge,
  type FileNode,
  type WorkspaceGraph,
} from "@quanta/canvas-engine";
import { buildQuadrantLayout } from "./build-quadrant-layout";

// ─────────────────────────────────────────────────────────────────────
// Test helpers — consistent with chord-view / matrix-view test patterns.

function makeFile(
  id: string,
  opts: Partial<Pick<FileNode, "loc" | "riskScore" | "signals">> = {},
): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "domain",
    riskScore: opts.riskScore ?? 20,
    loc: opts.loc ?? 10,
    signals: opts.signals ?? {
      taintCount: 0,
      blastCritical: 0,
      deadCount: 0,
      archViolations: 0,
      cpxMax: 0,
    },
    functions: [],
  };
}

function makeEdge(id: string, from: string, to: string, kind: FileEdge["kind"] = "import"): FileEdge {
  return { id, from, to, kind, layer: "structural", weight: 1 };
}

function makeGraph(
  files: FileNode[],
  edges: FileEdge[] = [],
  blame?: WorkspaceGraph["blame"],
): WorkspaceGraph {
  return { files, fileEdges: edges, comments: [], ...(blame ? { blame } : {}) };
}

const VIEWPORT = { width: 1600, height: 1000 };

// Fixed reference timestamp used in all blame-dependent tests so the
// 90-day churn window is deterministic without mocking Date.now.
const NOW_MS = 1_700_000_000_000; // 2023-11-14T22:13:20.000Z
const RECENT = NOW_MS - 10 * 24 * 60 * 60 * 1000;   // 10 days ago — inside window
const OLD    = NOW_MS - 200 * 24 * 60 * 60 * 1000;  // 200 days ago — outside window

// Convenience: pass nowMs as a typed escape hatch that the builder accepts.
function optsWithNow(extra: Record<string, unknown> = {}): Record<string, unknown> {
  return { nowMs: NOW_MS, ...extra };
}

// ─────────────────────────────────────────────────────────────────────

describe("buildQuadrantLayout — empty tree", () => {
  it("returns empty points for a workspace with no files", () => {
    const tree = buildEntityTree(makeGraph([]));
    const layout = buildQuadrantLayout({
      tree,
      graph: makeGraph([]),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(layout.points).toHaveLength(0);
    expect(layout.overflow).toBe(0);
    // Regions are always 4.
    expect(layout.regions).toHaveLength(4);
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("buildQuadrantLayout — no blame data (edge proxy fallback)", () => {
  it("two galaxies both get finite churn scores via the edge-touch fallback", () => {
    const files = [
      makeFile("pkgA/a1.ts"),
      makeFile("pkgA/a2.ts"),
      makeFile("pkgB/b1.ts"),
    ];
    const edges = [
      makeEdge("e1", "pkgA/a1.ts", "pkgB/b1.ts"),
      makeEdge("e2", "pkgA/a2.ts", "pkgB/b1.ts"),
    ];
    // No blame field in graph → fallback to edge-touch counts.
    const graph = makeGraph(files, edges);
    const tree = buildEntityTree(graph);
    const layout = buildQuadrantLayout({
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });

    expect(layout.points.length).toBeGreaterThanOrEqual(2);
    for (const pt of layout.points) {
      // Normalized x is in [0, 1] — no NaN, no Infinity.
      expect(isFinite(pt.x)).toBe(true);
      expect(pt.x).toBeGreaterThanOrEqual(0);
      expect(pt.x).toBeLessThanOrEqual(1);
      expect(isFinite(pt.xRaw)).toBe(true);
    }

    // pkgA has two files each touched by edges → higher raw churn than if zero.
    const pkgA = layout.points.find(p => p.label === "pkgA");
    const pkgB = layout.points.find(p => p.label === "pkgB");
    expect(pkgA).toBeDefined();
    expect(pkgB).toBeDefined();
    // pkgA's a1 + a2 each contribute 1 edge touch, so pkgA rawChurn >= 2.
    // pkgB's b1 is touched by 2 incoming edges → rawChurn >= 2 as well.
    expect(pkgA!.xRaw).toBeGreaterThan(0);
    expect(pkgB!.xRaw).toBeGreaterThan(0);
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("buildQuadrantLayout — blame data churn comparison", () => {
  it("a file touched 10 times recently scores higher churn than one never touched", () => {
    const files = [
      makeFile("hot/a.ts"),
      makeFile("cold/b.ts"),
    ];

    // Build blame: hot/a.ts has 10 recent entries; cold/b.ts has none.
    const blame: WorkspaceGraph["blame"] = {
      "hot/a.ts": {
        fileId: "hot/a.ts",
        lineCount: 100,
        entries: Array.from({ length: 10 }, (_, i) => ({
          startLine: i * 10 + 1,
          endLine: i * 10 + 10,
          committedAt: RECENT,
          author: "dev",
        })),
      },
      "cold/b.ts": {
        fileId: "cold/b.ts",
        lineCount: 50,
        entries: [
          {
            startLine: 1,
            endLine: 50,
            committedAt: OLD,
            author: "dev",
          },
        ],
      },
    };

    const graph = makeGraph(files, [], blame);
    const tree = buildEntityTree(graph);
    // Use building kind so each file is its own point.
    const layout = buildQuadrantLayout(
      Object.assign(
        {
          tree,
          graph,
          width: VIEWPORT.width,
          height: VIEWPORT.height,
          pointKind: "building" as const,
        },
        optsWithNow(),
      ),
    );

    const hot = layout.points.find(p => p.id === "hot/a.ts");
    const cold = layout.points.find(p => p.id === "cold/b.ts");
    expect(hot).toBeDefined();
    expect(cold).toBeDefined();

    // hot/a.ts has 10 recent blame entries; cold/b.ts has 0.
    expect(hot!.xRaw).toBe(10);
    expect(cold!.xRaw).toBe(0);
    // Normalized: hot should have x >= cold since it's the dominant entry.
    expect(hot!.x).toBeGreaterThan(cold!.x);
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("buildQuadrantLayout — risk scores", () => {
  it("risk scores reflect riskScore from FileNode", () => {
    const files = [
      makeFile("risky/a.ts", { riskScore: 90 }),
      makeFile("safe/b.ts",  { riskScore: 5  }),
    ];
    const graph = makeGraph(files);
    const tree = buildEntityTree(graph);
    const layout = buildQuadrantLayout({
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      pointKind: "building",
    });

    const risky = layout.points.find(p => p.id === "risky/a.ts");
    const safe  = layout.points.find(p => p.id === "safe/b.ts");
    expect(risky).toBeDefined();
    expect(safe).toBeDefined();

    // Higher riskScore → higher yRaw.
    expect(risky!.yRaw).toBeGreaterThan(safe!.yRaw);
    // Normalized: risky should have y >= safe.
    expect(risky!.y).toBeGreaterThanOrEqual(safe!.y);
  });

  it("secondary signal (taintCount) elevates risk even when riskScore is equal", () => {
    const files = [
      makeFile("tainted/a.ts", {
        riskScore: 20,
        signals: {
          taintCount: 10,
          blastCritical: 0,
          deadCount: 0,
          archViolations: 0,
          cpxMax: 0,
        },
      }),
      makeFile("clean/b.ts", { riskScore: 20 }),
    ];
    const graph = makeGraph(files);
    const tree = buildEntityTree(graph);
    const layout = buildQuadrantLayout({
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      pointKind: "building",
    });

    const tainted = layout.points.find(p => p.id === "tainted/a.ts");
    const clean   = layout.points.find(p => p.id === "clean/b.ts");
    expect(tainted).toBeDefined();
    expect(clean).toBeDefined();
    // tainted has taintCount=10 so secondary score = 10*3=30, normalizedSecondary ≈ 0.97
    // clean has secondary=0 → normalizedSecondary=0.
    // Final risk = riskScore*0.6 + normalizedSecondary*0.4
    expect(tainted!.yRaw).toBeGreaterThan(clean!.yRaw);
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("buildQuadrantLayout — maxPoints trim and overflow", () => {
  it("trims to maxPoints and reports overflow count", () => {
    // 15 files, each its own package (to get 15 galaxy points).
    const files: FileNode[] = [];
    const edges: FileEdge[] = [];
    for (let i = 0; i < 15; i++) {
      const id = `pkg${String(i).padStart(2, "0")}/a.ts`;
      files.push(makeFile(id, { riskScore: i * 5 }));
      // Add edges so churn fallback produces varied scores.
      if (i > 0) {
        edges.push(makeEdge(`e${i}`, `pkg${String(i - 1).padStart(2, "0")}/a.ts`, id));
      }
    }
    const graph = makeGraph(files, edges);
    const tree = buildEntityTree(graph);

    const layout = buildQuadrantLayout({
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      maxPoints: 10,
    });

    expect(layout.points).toHaveLength(10);
    expect(layout.overflow).toBe(5);
    // overflow + retained = total galaxy count
    expect(layout.points.length + layout.overflow).toBe(15);
  });
});

// ─────────────────────────────────────────────────────────────────────

describe("buildQuadrantLayout — output shape invariants", () => {
  it("all normalized values are in [0, 1]", () => {
    const files = Array.from({ length: 20 }, (_, i) =>
      makeFile(`pkg${i}/a.ts`, { riskScore: i * 4, loc: (i + 1) * 50 }),
    );
    const edges: FileEdge[] = [];
    for (let i = 1; i < 20; i++) {
      edges.push(makeEdge(`e${i}`, `pkg${i - 1}/a.ts`, `pkg${i}/a.ts`));
    }
    const graph = makeGraph(files, edges);
    const tree = buildEntityTree(graph);
    const layout = buildQuadrantLayout({
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });

    for (const pt of layout.points) {
      expect(pt.x).toBeGreaterThanOrEqual(0);
      expect(pt.x).toBeLessThanOrEqual(1);
      expect(pt.y).toBeGreaterThanOrEqual(0);
      expect(pt.y).toBeLessThanOrEqual(1);
      expect(pt.radius).toBeGreaterThanOrEqual(6);
      expect(pt.radius).toBeLessThanOrEqual(22);
    }
  });

  it("always returns exactly 4 regions", () => {
    const tree = buildEntityTree(makeGraph([]));
    const layout = buildQuadrantLayout({
      tree,
      graph: makeGraph([]),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });
    expect(layout.regions).toHaveLength(4);
    const ids = layout.regions.map(r => r.id).sort();
    expect(ids).toEqual([
      "stable-critical",
      "stable-safe",
      "volatile-critical",
      "volatile-safe",
    ]);
  });

  it("produces bit-identical output for identical inputs (determinism)", () => {
    const files = [
      makeFile("pkgA/a.ts", { riskScore: 40 }),
      makeFile("pkgA/b.ts", { riskScore: 60 }),
      makeFile("pkgB/c.ts", { riskScore: 10 }),
    ];
    const edges = [makeEdge("e1", "pkgA/a.ts", "pkgB/c.ts")];
    const graph = makeGraph(files, edges);
    const tree = buildEntityTree(graph);
    const sharedOpts = {
      tree,
      graph,
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    };
    const a = buildQuadrantLayout(sharedOpts);
    const b = buildQuadrantLayout(sharedOpts);
    expect(a).toEqual(b);
  });

  it("sublabel format matches pointKind", () => {
    const files = [makeFile("pkg/a.ts", { loc: 120, riskScore: 30 })];
    const graph = makeGraph(files);
    const tree = buildEntityTree(graph);

    const galaxyLayout = buildQuadrantLayout({
      tree, graph, width: 800, height: 600,
    });
    // Galaxy default — "N files · risk X.XX"
    if (galaxyLayout.points.length > 0) {
      expect(galaxyLayout.points[0]!.sublabel).toMatch(/\d+ files · risk \d+\.\d{2}/);
    }

    const buildingLayout = buildQuadrantLayout({
      tree, graph, width: 800, height: 600, pointKind: "building",
    });
    // Building mode — "N LoC · risk X.XX"
    if (buildingLayout.points.length > 0) {
      expect(buildingLayout.points[0]!.sublabel).toMatch(/\d+ LoC · risk \d+\.\d{2}/);
    }
  });
});
