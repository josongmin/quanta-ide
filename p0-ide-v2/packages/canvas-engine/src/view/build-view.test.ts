import { describe, it, expect } from "vitest";
import { buildWorkspaceView, buildWorkspaceScene } from "./build-view";
import type { WorkspaceGraph, FileNode, Rect } from "../graph/types";
import type { WorkspaceLayout, ClusterMeta, BezierRoute } from "../layout/types";
import type {
  Viewport,
  LodLevel,
  WorkspaceFileView,
  WorkspaceClusterView,
  WorkspaceSuperclusterView,
} from "./types";

function makeFile(id: string): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "unknown",
    riskScore: 0.1,
    loc: 100,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 1 },
    functions: [],
  };
}

function makeLayout(
  fileIds: string[],
  opts?: { clusters?: ClusterMeta[]; superclusters?: ClusterMeta[] },
): WorkspaceLayout {
  const fileRects = new Map<string, Rect>();
  fileIds.forEach((id, i) => {
    fileRects.set(id, { x: i * 100, y: 0, w: 90, h: 90 });
  });
  return {
    fileRects,
    edgeRoutes: new Map<string, BezierRoute>(),
    aggregates: {
      commentsByFunction: new Map(),
      commentsByFile: new Map(),
      commentedLines: new Map(),
    },
    totalBounds: { x: 0, y: 0, w: fileIds.length * 100, h: 100 },
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

describe("buildWorkspaceView (back-compat, always file-level)", () => {
  const graph: WorkspaceGraph = {
    files: [makeFile("a.rs"), makeFile("b.rs")],
    fileEdges: [],
    comments: [],
  };
  const layout = makeLayout(["a.rs", "b.rs"]);
  const viewport: Viewport = { x: 0, y: 0, scale: 1, width: 1000, height: 1000 };

  it("returns file view regardless of lod", () => {
    // `buildWorkspaceView` ignores `lod` by design; it's the back-compat
    // entry for callers that don't handle cluster/supercluster tiers.
    for (const lod of ["universe", "supergalaxy", "galaxy", "city", "street", "ground"] as LodLevel[]) {
      const view = buildWorkspaceView({ graph, layout, viewport, lod });
      expect(view.files.length).toBe(2);
    }
  });
});

describe("buildWorkspaceScene (LOD-aware)", () => {
  const graph: WorkspaceGraph = {
    files: [makeFile("a.rs"), makeFile("b.rs")],
    fileEdges: [],
    comments: [],
  };
  const clusters: ClusterMeta[] = [
    { id: "cl", rect: { x: 0, y: 0, w: 100, h: 100 }, fileCount: 2, locSum: 200 },
  ];
  const superclusters: ClusterMeta[] = [
    { id: "sc", rect: { x: 0, y: 0, w: 500, h: 500 }, fileCount: 2, locSum: 200 },
  ];
  const layout = makeLayout(["a.rs", "b.rs"], { clusters, superclusters });
  const viewport: Viewport = { x: 0, y: 0, scale: 1, width: 1000, height: 1000 };

  it("returns supercluster view at universe LOD", () => {
    const scene = buildWorkspaceScene({ graph, layout, viewport, lod: "universe" });
    expect((scene as WorkspaceSuperclusterView).kind).toBe("universe");
  });

  it("returns cluster view at supergalaxy LOD", () => {
    const scene = buildWorkspaceScene({ graph, layout, viewport, lod: "supergalaxy" });
    expect((scene as WorkspaceClusterView).kind).toBe("supergalaxy");
  });

  it("returns file view at galaxy LOD", () => {
    const scene = buildWorkspaceScene({ graph, layout, viewport, lod: "galaxy" });
    const cast = scene as WorkspaceFileView;
    expect(cast.kind).toBe("files");
    expect(cast.files.length).toBe(2);
  });

  it("returns file view at city LOD", () => {
    const scene = buildWorkspaceScene({ graph, layout, viewport, lod: "city" });
    const cast = scene as WorkspaceFileView;
    expect(cast.files.length).toBe(2);
  });

  it("returns file view at street LOD", () => {
    const scene = buildWorkspaceScene({ graph, layout, viewport, lod: "street" });
    const cast = scene as WorkspaceFileView;
    expect(cast.files.length).toBe(2);
  });

  it("returns file view at ground LOD", () => {
    const scene = buildWorkspaceScene({ graph, layout, viewport, lod: "ground" });
    const cast = scene as WorkspaceFileView;
    expect(cast.files.length).toBe(2);
  });
});
