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
import { getTierConfig } from "../lod/lod-config";

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
  // Empty / malformed graph guard: no cluster data to query.
  if (clusters.length === 0) {
    return { kind: "supergalaxy", clusters: [] };
  }
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
  // Empty / malformed graph guard: no files or no laid-out rects means
  // there's nothing to spatially query. Return an empty scene with the
  // correct discriminator instead of running FileIndex.load on empty data.
  if (graph.files.length === 0 || layout.fileRects.size === 0) {
    return { kind: "files", files: [], edges: [], comments: [] };
  }
  // Container size not yet reported (before first ResizeObserver tick):
  // returning an empty scene here causes a blank flash that persists until
  // the next viewport update. Return everything instead so the renderer
  // always has something to draw while the exact viewport is being set up.
  if (viewport.width <= 0 || viewport.height <= 0) {
    return {
      kind: "files",
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

  return { kind: "files", files, edges, comments };
}

/**
 * LOD-aware scene builder. The tier's `sceneKind` (from lod-config) decides
 * which query helper runs:
 *   - `"superclusters"` → supercluster view (universe).
 *   - `"clusters"`      → cluster view (supergalaxy).
 *   - `"files"`         → standard file view (galaxy / city / street / ground).
 *
 * Cascading fallback is honored via each tier's `fallback` chain: if the
 * requested kind has no data (e.g. layout emits no superclusters), we walk
 * down to the next tier whose data is available. This degrades gracefully
 * on grid-layout graphs that produce neither clusters nor superclusters.
 */
export function buildSceneQuery(
  graph: WorkspaceGraph,
  layout: WorkspaceLayout,
  viewport: Viewport,
  lod: LodLevel,
): WorkspaceScene {
  // Walk the config-declared fallback chain until we reach a `sceneKind`
  // whose backing data exists. File-level is the universal terminus.
  let cursor = getTierConfig(lod);
  // Bounded by ladder depth; defensive against accidentally circular chains.
  for (let hop = 0; hop < 8; hop++) {
    if (cursor.sceneKind === "superclusters") {
      if (layout.superclusters && layout.superclusters.length > 0) {
        return buildSuperclusterQuery(layout, viewport);
      }
    } else if (cursor.sceneKind === "clusters") {
      if (layout.clusters && layout.clusters.length > 0) {
        return buildClusterQuery(layout, viewport);
      }
    } else {
      // "files" — always satisfiable (empty scene is handled inside the helper).
      return buildVisibleQuery(graph, layout, viewport);
    }
    // Fallback wasn't satisfied — descend one rung.
    if (!cursor.fallback) break;
    cursor = getTierConfig(cursor.fallback);
  }
  return buildVisibleQuery(graph, layout, viewport);
}
