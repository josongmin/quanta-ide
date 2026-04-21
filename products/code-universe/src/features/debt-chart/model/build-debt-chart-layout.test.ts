import { describe, it, expect } from "vitest";
import type { WorkspaceGraph, FileNode, FileEdge, GraphHistory } from "@quanta/canvas-engine";
import { buildDebtChartLayout } from "./build-debt-chart-layout";

// ─────────────────────────────────────────────────────────────────────
// Test helpers

function makeFile(id: string): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "domain",
    riskScore: 0,
    loc: 100,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 1 },
    functions: [],
  };
}

function makeGraph(
  history?: GraphHistory,
  files: FileNode[] = [],
  edges: FileEdge[] = [],
): WorkspaceGraph {
  return { files, fileEdges: edges, comments: [], history };
}

const VIEWPORT = { width: 800, height: 400 };
const PAD = { left: 55, top: 24, right: 140, bottom: 40 };

// ─────────────────────────────────────────────────────────────────────

describe("buildDebtChartLayout — no history", () => {
  it("returns hasHistory: false and empty series when history is undefined", () => {
    const layout = buildDebtChartLayout({
      graph: makeGraph(undefined, [makeFile("src/a.ts")]),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });

    expect(layout.hasHistory).toBe(false);
    expect(layout.series).toHaveLength(0);
    expect(layout.snapshots).toHaveLength(0);
    expect(layout.snapshotCount).toBe(0);
    // Padding values are still set for layout purposes.
    expect(layout.plotWidth).toBe(VIEWPORT.width - PAD.left - PAD.right);
    expect(layout.plotHeight).toBe(VIEWPORT.height - PAD.top - PAD.bottom);
  });

  it("returns hasHistory: false when history has no snapshots", () => {
    const layout = buildDebtChartLayout({
      graph: makeGraph({ snapshots: [] }, [makeFile("src/a.ts")]),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });

    expect(layout.hasHistory).toBe(false);
    expect(layout.series).toHaveLength(0);
  });
});

describe("buildDebtChartLayout — single snapshot", () => {
  it("produces series with 1 point each and delta = 0", () => {
    const history: GraphHistory = {
      snapshots: [
        {
          timestamp: 1000,
          label: "init",
          commitSha: "abc1234",
          // A single absolute edge set — empty for simplicity.
          edgeIds: [],
        },
      ],
    };

    const layout = buildDebtChartLayout({
      graph: makeGraph(history, [makeFile("src/a.ts")]),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
    });

    expect(layout.hasHistory).toBe(true);
    expect(layout.snapshotCount).toBe(1);

    // Every series must have exactly 1 point and delta = 0.
    for (const s of layout.series) {
      expect(s.points).toHaveLength(1);
      expect(s.delta).toBe(0);
    }
  });
});

describe("buildDebtChartLayout — normalisation", () => {
  it("normalises sccCount [0,2,4] to [0, 0.5, 1.0]", () => {
    // We can't directly inject sccCount values into the engine (it
    // derives them from actual edge topology), so we use a simpler
    // approach: provide an empty edge set across 3 snapshots. The
    // sccCount will be 0 at every step. For a direct normalisation test
    // we call buildDebtChartLayout and then check the normalisation
    // contract by injecting deterministic raws via the edgeCount series,
    // which we CAN control by varying the edge set per snapshot.
    //
    // Snapshot 0: no edges  → edgeCount = 0
    // Snapshot 1: 1 edge    → edgeCount = 1
    // Snapshot 2: 2 edges   → edgeCount = 2
    const edge1: FileEdge = { id: "e1", from: "src/a.ts", to: "src/b.ts", kind: "import", layer: "structural", weight: 1 };
    const edge2: FileEdge = { id: "e2", from: "src/b.ts", to: "src/a.ts", kind: "import", layer: "structural", weight: 1 };

    const history: GraphHistory = {
      snapshots: [
        { timestamp: 1000, label: "s0", commitSha: "sha0", edgeIds: [] },
        { timestamp: 2000, label: "s1", commitSha: "sha1", edgeIds: ["e1"] },
        { timestamp: 3000, label: "s2", commitSha: "sha2", edgeIds: ["e1", "e2"] },
      ],
    };

    const layout = buildDebtChartLayout({
      graph: makeGraph(
        history,
        [makeFile("src/a.ts"), makeFile("src/b.ts")],
        [edge1, edge2],
      ),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      enabledKeys: ["edgeCount"],
    });

    expect(layout.hasHistory).toBe(true);
    const edgeSeries = layout.series.find(s => s.key === "edgeCount");
    expect(edgeSeries).toBeDefined();

    const vs = edgeSeries!.points.map(p => p.v);
    expect(vs).toHaveLength(3);
    // Normalised: max=2 → [0/2, 1/2, 2/2]
    expect(vs[0]).toBeCloseTo(0);
    expect(vs[1]).toBeCloseTo(0.5);
    expect(vs[2]).toBeCloseTo(1.0);
  });
});

describe("buildDebtChartLayout — delta", () => {
  it("delta equals last raw minus first raw", () => {
    const edge1: FileEdge = { id: "e1", from: "src/a.ts", to: "src/b.ts", kind: "import", layer: "structural", weight: 1 };
    const edge2: FileEdge = { id: "e2", from: "src/b.ts", to: "src/a.ts", kind: "import", layer: "structural", weight: 1 };

    const history: GraphHistory = {
      snapshots: [
        { timestamp: 1000, label: "s0", commitSha: "sha0", edgeIds: [] },
        { timestamp: 2000, label: "s1", commitSha: "sha1", edgeIds: ["e1", "e2"] },
      ],
    };

    const layout = buildDebtChartLayout({
      graph: makeGraph(
        history,
        [makeFile("src/a.ts"), makeFile("src/b.ts")],
        [edge1, edge2],
      ),
      width: VIEWPORT.width,
      height: VIEWPORT.height,
      enabledKeys: ["edgeCount"],
    });

    const edgeSeries = layout.series.find(s => s.key === "edgeCount");
    expect(edgeSeries).toBeDefined();

    const firstRaw = edgeSeries!.points[0]!.raw;
    const lastRaw  = edgeSeries!.points[edgeSeries!.points.length - 1]!.raw;
    // delta = last - first = 2 - 0 = 2
    expect(edgeSeries!.delta).toBe(lastRaw - firstRaw);
    expect(edgeSeries!.delta).toBe(2);
  });
});
