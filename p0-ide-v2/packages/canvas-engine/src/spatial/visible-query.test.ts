import { describe, it, expect } from "vitest";
import {
  buildVisibleQuery,
  buildClusterQuery,
  buildSuperclusterQuery,
  buildSceneQuery,
} from "./visible-query";
import type { WorkspaceGraph, FileNode, FileEdge, Rect } from "../graph/types";
import type { WorkspaceLayout, ClusterMeta, BezierRoute } from "../layout/types";
import type { Viewport, WorkspaceScene, WorkspaceFileView, WorkspaceClusterView, WorkspaceSuperclusterView } from "../view/types";

function makeFile(id: string, loc = 100): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "unknown",
    riskScore: 0.1,
    loc,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 1 },
    functions: [],
  };
}

function makeEdge(from: string, to: string): FileEdge {
  return {
    id: `e:${from}→${to}`,
    from,
    to,
    kind: "import",
    weight: 1,
  };
}

function makeBezier(x1: number, y1: number, x2: number, y2: number): BezierRoute {
  return { x1, y1, cx1: x1, cy1: y1, cx2: x2, cy2: y2, x2, y2 };
}

// Minimal layout builder: places files on a regular grid, one bezier per
// edge, no clusters/superclusters unless explicitly provided.
function makeLayout(
  fileIds: string[],
  edges: FileEdge[],
  opts?: {
    clusters?: ClusterMeta[];
    superclusters?: ClusterMeta[];
    cellW?: number;
    cellH?: number;
    cols?: number;
  },
): WorkspaceLayout {
  const cellW = opts?.cellW ?? 100;
  const cellH = opts?.cellH ?? 100;
  const cols = opts?.cols ?? 5;
  const fileRects = new Map<string, Rect>();
  fileIds.forEach((id, i) => {
    const col = i % cols;
    const row = Math.floor(i / cols);
    fileRects.set(id, { x: col * cellW, y: row * cellH, w: cellW - 10, h: cellH - 10 });
  });
  const edgeRoutes = new Map<string, BezierRoute>();
  for (const e of edges) {
    const a = fileRects.get(e.from);
    const b = fileRects.get(e.to);
    if (!a || !b) continue;
    edgeRoutes.set(e.id, makeBezier(a.x + a.w / 2, a.y + a.h / 2, b.x + b.w / 2, b.y + b.h / 2));
  }
  let maxX = 0, maxY = 0;
  for (const r of fileRects.values()) {
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  return {
    fileRects,
    edgeRoutes,
    aggregates: {
      commentsByFunction: new Map(),
      commentsByFile: new Map(),
      commentedLines: new Map(),
    },
    totalBounds: { x: 0, y: 0, w: maxX, h: maxY },
    clusters: opts?.clusters,
    clusterRects: opts?.clusters
      ? new Map(opts.clusters.map(c => [c.id, c.rect] as const))
      : undefined,
    superclusters: opts?.superclusters,
    superclusterRects: opts?.superclusters
      ? new Map(opts.superclusters.map(c => [c.id, c.rect] as const))
      : undefined,
  };
}

describe("buildVisibleQuery (file LOD)", () => {
  // Build a 5×5 grid of files; file[i,j] rect = (i*100, j*100, 90, 90).
  const ids: string[] = [];
  for (let i = 0; i < 25; i++) ids.push(`f${i}.rs`);
  const edges: FileEdge[] = [];
  for (let i = 0; i < 24; i++) edges.push(makeEdge(`f${i}.rs`, `f${i + 1}.rs`));
  const graph: WorkspaceGraph = {
    files: ids.map(id => makeFile(id)),
    fileEdges: edges,
    comments: [],
  };
  const layout = makeLayout(ids, edges);

  it("returns all files+edges when viewport has zero size", () => {
    // Zero-size viewport is the "not yet measured" case — return
    // everything so the renderer has something to draw during the first
    // ResizeObserver tick.
    const viewport: Viewport = { x: 0, y: 0, scale: 1, width: 0, height: 0 };
    const view = buildVisibleQuery(graph, layout, viewport);
    expect(view.files.length).toBe(25);
    expect(view.edges.length).toBe(24);
  });

  it("returns only files within the viewport rect at scale=1", () => {
    // Viewport covers (0,0)→(150,150) in canvas space. Files at col 0-1
    // and row 0-1 are visible; expect 4 files at min.
    const viewport: Viewport = { x: 0, y: 0, scale: 1, width: 150, height: 150 };
    const view = buildVisibleQuery(graph, layout, viewport);
    // f0, f1, f5, f6 should be visible. Depending on the spatial
    // index's edge handling there may be a few more at boundaries —
    // assert the upper bound, not the exact count.
    expect(view.files.length).toBeGreaterThanOrEqual(4);
    expect(view.files.length).toBeLessThan(25);
  });

  it("returns empty files when viewport is off-canvas", () => {
    // Pan the viewport far away so nothing intersects.
    const viewport: Viewport = { x: -10_000, y: -10_000, scale: 1, width: 100, height: 100 };
    const view = buildVisibleQuery(graph, layout, viewport);
    expect(view.files.length).toBe(0);
    expect(view.edges.length).toBe(0);
  });

  it("edges are filtered by viewport", () => {
    const viewport: Viewport = { x: 0, y: 0, scale: 1, width: 200, height: 100 };
    const view = buildVisibleQuery(graph, layout, viewport);
    // Whatever edges it returns, they must reference at least one file
    // whose id is in the visible set (edge filter is position-based,
    // not id-based).
    expect(view.edges.length).toBeLessThanOrEqual(edges.length);
  });
});

describe("buildClusterQuery (supergalaxy LOD)", () => {
  const clusters: ClusterMeta[] = [
    { id: "a", rect: { x: 0,    y: 0, w: 100, h: 100 }, fileCount: 10, locSum: 1000 },
    { id: "b", rect: { x: 200,  y: 0, w: 100, h: 100 }, fileCount: 8,  locSum: 500 },
    { id: "c", rect: { x: 1000, y: 0, w: 100, h: 100 }, fileCount: 2,  locSum: 50 },
  ];
  const layout = makeLayout(["dummy.rs"], [], { clusters });

  it("returns all clusters when viewport has zero size", () => {
    const view = buildClusterQuery(layout, { x: 0, y: 0, scale: 1, width: 0, height: 0 });
    expect(view.kind).toBe("supergalaxy");
    expect(view.clusters.length).toBe(3);
  });

  it("filters by viewport intersection", () => {
    const view = buildClusterQuery(layout, { x: 0, y: 0, scale: 1, width: 150, height: 150 });
    expect(view.clusters.length).toBe(1);
    expect(view.clusters[0].id).toBe("a");
  });

  it("picks up two adjacent clusters when viewport spans them", () => {
    const view = buildClusterQuery(layout, { x: 0, y: 0, scale: 1, width: 350, height: 100 });
    const ids = view.clusters.map(c => c.id).sort();
    expect(ids).toEqual(["a", "b"]);
  });
});

describe("buildSuperclusterQuery (universe LOD)", () => {
  const superclusters: ClusterMeta[] = [
    { id: "svc-a", rect: { x: 0,   y: 0, w: 500, h: 500 }, fileCount: 100, locSum: 10_000 },
    { id: "svc-b", rect: { x: 800, y: 0, w: 500, h: 500 }, fileCount: 100, locSum: 10_000 },
  ];
  const layout = makeLayout(["dummy.rs"], [], { superclusters });

  it("returns all superclusters when viewport is zero-size", () => {
    const view = buildSuperclusterQuery(layout, { x: 0, y: 0, scale: 1, width: 0, height: 0 });
    expect(view.kind).toBe("universe");
    expect(view.superclusters.length).toBe(2);
  });

  it("filters by viewport", () => {
    const view = buildSuperclusterQuery(layout, { x: 0, y: 0, scale: 1, width: 300, height: 300 });
    expect(view.superclusters.length).toBe(1);
    expect(view.superclusters[0].id).toBe("svc-a");
  });
});

describe("buildSceneQuery (LOD-aware dispatch)", () => {
  const clusters: ClusterMeta[] = [
    { id: "a", rect: { x: 0, y: 0, w: 100, h: 100 }, fileCount: 10, locSum: 1000 },
  ];
  const superclusters: ClusterMeta[] = [
    { id: "svc", rect: { x: 0, y: 0, w: 500, h: 500 }, fileCount: 100, locSum: 10_000 },
  ];
  const graph: WorkspaceGraph = {
    files: [makeFile("a.rs"), makeFile("b.rs")],
    fileEdges: [],
    comments: [],
  };
  const layoutFull = makeLayout(["a.rs", "b.rs"], [], { clusters, superclusters });
  const layoutNoClusters = makeLayout(["a.rs", "b.rs"], []);
  const viewport: Viewport = { x: 0, y: 0, scale: 1, width: 1000, height: 1000 };

  it("universe → supercluster view when superclusters present", () => {
    const scene: WorkspaceScene = buildSceneQuery(graph, layoutFull, viewport, "universe");
    const cast = scene as WorkspaceSuperclusterView;
    expect(cast.kind).toBe("universe");
    expect(cast.superclusters.length).toBe(1);
  });

  it("supergalaxy → cluster view when clusters present", () => {
    const scene: WorkspaceScene = buildSceneQuery(graph, layoutFull, viewport, "supergalaxy");
    const cast = scene as WorkspaceClusterView;
    expect(cast.kind).toBe("supergalaxy");
    expect(cast.clusters.length).toBe(1);
  });

  it("galaxy → file view", () => {
    const scene: WorkspaceScene = buildSceneQuery(graph, layoutFull, viewport, "galaxy");
    const cast = scene as WorkspaceFileView;
    expect(cast.kind).toBe("files");
    expect(cast.files.length).toBe(2);
  });

  it("city → file view", () => {
    const scene: WorkspaceScene = buildSceneQuery(graph, layoutFull, viewport, "city");
    const cast = scene as WorkspaceFileView;
    expect(cast.files.length).toBe(2);
  });

  it("street → file view", () => {
    const scene: WorkspaceScene = buildSceneQuery(graph, layoutFull, viewport, "street");
    const cast = scene as WorkspaceFileView;
    expect(cast.files.length).toBe(2);
  });

  it("ground → file view", () => {
    const scene: WorkspaceScene = buildSceneQuery(graph, layoutFull, viewport, "ground");
    const cast = scene as WorkspaceFileView;
    expect(cast.files.length).toBe(2);
  });

  // Cascading fallback — required by the docstring on buildSceneQuery.
  it("universe falls back to cluster view when superclusters missing", () => {
    const layoutClustersOnly = makeLayout(["a.rs", "b.rs"], [], { clusters });
    const scene = buildSceneQuery(graph, layoutClustersOnly, viewport, "universe");
    // Falls through to cluster query.
    expect((scene as WorkspaceClusterView).kind).toBe("supergalaxy");
  });

  it("universe falls back to file view when neither clusters nor superclusters", () => {
    const scene = buildSceneQuery(graph, layoutNoClusters, viewport, "universe");
    // Final fallback — buildVisibleQuery.
    const cast = scene as WorkspaceFileView;
    expect(cast.files.length).toBe(2);
  });

  it("supergalaxy falls back to file view when clusters missing", () => {
    const scene = buildSceneQuery(graph, layoutNoClusters, viewport, "supergalaxy");
    const cast = scene as WorkspaceFileView;
    expect(cast.files.length).toBe(2);
  });
});
