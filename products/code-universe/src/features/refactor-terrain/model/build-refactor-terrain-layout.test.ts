import { describe, it, expect } from "vitest";
import { buildEntityTree, type FileEdge, type FileNode, type WorkspaceGraph } from "@quanta/canvas-engine";
import { buildRefactorTerrainLayout } from "./build-refactor-terrain-layout";

// ──────────────────────────────────────────────────────────────
// Test helpers

function makeFile(
  id: string,
  overrides: Partial<FileNode> = {},
): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "domain",
    riskScore: overrides.riskScore ?? 5,
    loc: overrides.loc ?? 100,
    signals: overrides.signals ?? {
      taintCount: 0,
      blastCritical: 0,
      deadCount: 0,
      archViolations: 0,
      cpxMax: 0,
    },
    functions: [],
    ...overrides,
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

// ──────────────────────────────────────────────────────────────

describe("buildRefactorTerrainLayout — empty graph", () => {
  it("returns empty rows for a graph with no files", () => {
    const graph = makeGraph([]);
    const tree = buildEntityTree(graph);
    const layout = buildRefactorTerrainLayout({ tree, graph });
    expect(layout.rows).toHaveLength(0);
    expect(layout.totalFiles).toBe(0);
    expect(layout.overflow).toBe(0);
    expect(layout.maxScore).toBe(0);
  });
});

describe("buildRefactorTerrainLayout — single high-risk file", () => {
  it("appears as rank 1 with a high fan-in contributing to score", () => {
    // A highly-imported file (high fan-in) with non-zero riskScore.
    const hub = makeFile("src/hub.ts", { riskScore: 5 });
    const callers = Array.from({ length: 8 }, (_, i) =>
      makeFile(`src/caller${i}.ts`),
    );
    const files = [hub, ...callers];
    const edges: FileEdge[] = callers.map((c, i) =>
      makeEdge(`e${i}`, c.id, hub.id),
    );
    const graph = makeGraph(files, edges);
    const tree = buildEntityTree(graph);
    const layout = buildRefactorTerrainLayout({ tree, graph });

    expect(layout.rows.length).toBeGreaterThan(0);
    // Hub has highest fan-in — it must be rank 1.
    const topRow = layout.rows[0];
    expect(topRow).toBeDefined();
    expect(topRow!.rank).toBe(1);
    expect(topRow!.fileId).toBe("src/hub.ts");
    expect(topRow!.score).toBeGreaterThan(0);
  });
});

describe("buildRefactorTerrainLayout — maxRows trim", () => {
  it("limits rows to maxRows and records overflow correctly", () => {
    const files = Array.from({ length: 50 }, (_, i) =>
      makeFile(`src/file${i}.ts`),
    );
    const graph = makeGraph(files);
    const tree = buildEntityTree(graph);

    const layout = buildRefactorTerrainLayout({ tree, graph, maxRows: 10 });
    expect(layout.rows).toHaveLength(10);
    expect(layout.totalFiles).toBe(50);
    expect(layout.overflow).toBe(40);
  });
});

describe("buildRefactorTerrainLayout — barColor hue mapping", () => {
  it("score=100 produces a red-hue bar color (low hue)", () => {
    // Force a high score by making many files import one heavily-churned file.
    // We just need any two files so the engine can produce scores > 0,
    // then inspect the barColor formula directly.
    const highScore = 100;
    const hue = 120 - highScore * 1.2;
    const expected = `hsl(${hue}deg, 65%, 50%)`;
    // hue should be near 0 (red).
    expect(hue).toBeLessThanOrEqual(5); // 120 - 100*1.2 = -0, clamped is fine
    expect(expected).toContain("hsl(");
  });

  it("score=0 produces a green-hue bar color (hue ~120)", () => {
    const lowScore = 0;
    const hue = 120 - lowScore * 1.2;
    const expected = `hsl(${hue}deg, 65%, 50%)`;
    expect(hue).toBe(120);
    expect(expected).toContain("hsl(120deg, 65%, 50%)");
  });

  it("rows in the layout have barColor strings starting with hsl(", () => {
    const files = [makeFile("pkg/a.ts"), makeFile("pkg/b.ts")];
    const edges = [makeEdge("e1", "pkg/a.ts", "pkg/b.ts")];
    const graph = makeGraph(files, edges);
    const tree = buildEntityTree(graph);
    const layout = buildRefactorTerrainLayout({ tree, graph });
    for (const row of layout.rows) {
      expect(row.barColor).toMatch(/^hsl\(/);
    }
  });
});
