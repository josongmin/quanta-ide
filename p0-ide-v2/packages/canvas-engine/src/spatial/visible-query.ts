import type { WorkspaceGraph } from "../graph/types";
import type { WorkspaceLayout, ClusterMeta } from "../layout/types";
import type {
  WorkspaceView,
  WorkspaceClusterView,
  WorkspaceSuperclusterView,
  WorkspaceScene,
  Viewport,
  LodLevel,
} from "../view/types";
import { FileIndex } from "./file-index";
import { EdgeFilter } from "./edge-filter";

interface SpatialCache {
  fileIndex: FileIndex;
  edgeFilter: EdgeFilter;
}

// WeakMap: auto-invalidates when layout object is GC'd
const spatialCache = new WeakMap<WorkspaceLayout, SpatialCache>();

function getSpatialCache(graph: WorkspaceGraph, layout: WorkspaceLayout): SpatialCache {
  const cached = spatialCache.get(layout);
  if (cached) return cached;

  const fileIndex = new FileIndex();
  fileIndex.load(layout.fileRects);

  const edgeFilter = new EdgeFilter();
  edgeFilter.load(graph.fileEdges.map(e => e.id), layout.edgeRoutes);

  const entry: SpatialCache = { fileIndex, edgeFilter };
  spatialCache.set(layout, entry);
  return entry;
}

function viewportToCanvas(viewport: Viewport): { x: number; y: number; w: number; h: number } {
  return {
    x: -viewport.x / viewport.scale,
    y: -viewport.y / viewport.scale,
    w: viewport.width / viewport.scale,
    h: viewport.height / viewport.scale,
  };
}

function rectsIntersect(
  a: { x: number; y: number; w: number; h: number },
  b: { x: number; y: number; w: number; h: number },
): boolean {
  return !(a.x + a.w < b.x || b.x + b.w < a.x || a.y + a.h < b.y || b.y + b.h < a.y);
}

/**
 * Supergalaxy scene: returns cluster boxes intersecting the viewport.
 * No per-file spatial query, no edges — this is the cheap tier.
 */
export function buildClusterQuery(
  layout: WorkspaceLayout,
  viewport: Viewport,
): WorkspaceClusterView {
  const clusters = layout.clusters ?? [];
  if (viewport.width <= 0 || viewport.height <= 0) {
    return { kind: "supergalaxy", clusters };
  }
  const canvasRect = viewportToCanvas(viewport);
  const visible: ClusterMeta[] = [];
  for (const c of clusters) {
    if (rectsIntersect(c.rect, canvasRect)) visible.push(c);
  }
  return { kind: "supergalaxy", clusters: visible };
}

/**
 * Universe scene: returns supercluster boxes intersecting the viewport.
 * One tier above supergalaxy — collapses parents of clusters (e.g. all
 * crates/, tests/ for quanta-v2; each service in an MSA monorepo).
 */
export function buildSuperclusterQuery(
  layout: WorkspaceLayout,
  viewport: Viewport,
): WorkspaceSuperclusterView {
  const superclusters = layout.superclusters ?? [];
  if (viewport.width <= 0 || viewport.height <= 0) {
    return { kind: "universe", superclusters };
  }
  const canvasRect = viewportToCanvas(viewport);
  const visible: ClusterMeta[] = [];
  for (const c of superclusters) {
    if (rectsIntersect(c.rect, canvasRect)) visible.push(c);
  }
  return { kind: "universe", superclusters: visible };
}

/**
 * File-level scene (galaxy / city / street / ground). Same behavior as
 * before — unchanged API for existing callers.
 */
export function buildVisibleQuery(
  graph: WorkspaceGraph,
  layout: WorkspaceLayout,
  viewport: Viewport,
): WorkspaceView {
  // Container size not yet reported (before first ResizeObserver tick):
  // returning an empty scene here causes a blank flash that persists until
  // the next viewport update. Return everything instead so the renderer
  // always has something to draw while the exact viewport is being set up.
  if (viewport.width <= 0 || viewport.height <= 0) {
    return {
      files: graph.files,
      edges: graph.fileEdges,
      comments: graph.comments,
    };
  }

  const canvasRect = viewportToCanvas(viewport);
  const { fileIndex, edgeFilter } = getSpatialCache(graph, layout);

  const visibleFileIds = new Set(fileIndex.query(canvasRect));
  const files = graph.files.filter((f) => visibleFileIds.has(f.id));

  const visibleEdgeIds = new Set(edgeFilter.query(canvasRect));
  const edges = graph.fileEdges.filter((e) => visibleEdgeIds.has(e.id));

  const comments = graph.comments.filter((c) => visibleFileIds.has(c.fileId));

  return { files, edges, comments };
}

/**
 * LOD-aware scene builder. At `supergalaxy` returns a cluster view; at any
 * other LOD returns the standard file view. Consumers can switch on the
 * `kind` discriminant (use `isClusterView`).
 */
export function buildSceneQuery(
  graph: WorkspaceGraph,
  layout: WorkspaceLayout,
  viewport: Viewport,
  lod: LodLevel,
): WorkspaceScene {
  if (lod === "supergalaxy" && layout.clusters && layout.clusters.length > 0) {
    return buildClusterQuery(layout, viewport);
  }
  return buildVisibleQuery(graph, layout, viewport);
}
