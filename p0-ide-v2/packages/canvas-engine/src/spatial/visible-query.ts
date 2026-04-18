import type { WorkspaceGraph, FileNode, FileEdge } from "../graph/types";
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
import { buildIdIndex, ensureBitsetCapacity } from "./id-index";
import { getTierConfig } from "../lod/lod-config";

interface SpatialCache {
  fileIndex: FileIndex;
  edgeFilter: EdgeFilter;
  /** `fileId → index` used for bitset membership (comments → visible files). */
  fileIdToIndex: Map<string, number>;
  /** `fileId → FileNode` for O(1) hydration of rbush hits back into nodes. */
  fileById: Map<string, FileNode>;
  /** `edgeId → FileEdge` for O(1) hydration. */
  edgeById: Map<string, FileEdge>;
  /** Identity of the graph used to build the id/node/edge lookups. If the
   *  graph reference changes under a stable layout (rare but possible when
   *  callers swap graph data while reusing a layout), we rebuild lazily. */
  graphRef: WorkspaceGraph;
  /** Scratch bitset for "is fileId visible?" membership tests during the
   *  comments filter. **Per-cache** (and therefore per-layout) so multiple
   *  canvases / graphs querying concurrently don't clobber each other's
   *  membership state. Reused across frames — `.fill(0)` at the top of
   *  each `buildVisibleQuery` call. Grows in place via
   *  `ensureBitsetCapacity`; never shrinks. */
  visibleFileBitset: Uint8Array;
}

// WeakMap: auto-invalidates when layout object is GC'd
const spatialCache = new WeakMap<WorkspaceLayout, SpatialCache>();

function getSpatialCache(graph: WorkspaceGraph, layout: WorkspaceLayout): SpatialCache {
  const cached = spatialCache.get(layout);
  if (cached && cached.graphRef === graph) return cached;

  const fileIndex = new FileIndex();
  fileIndex.load(layout.fileRects);

  const edgeFilter = new EdgeFilter();
  // Build the edge-id list inline (for-loop, no intermediate .map array
  // of edge objects). This path runs once per layout so allocation
  // pressure here is irrelevant — but staying consistent with the rest
  // of the hot-path style.
  const edgeIds: string[] = new Array(graph.fileEdges.length);
  for (let i = 0; i < graph.fileEdges.length; i++) edgeIds[i] = graph.fileEdges[i].id;
  edgeFilter.load(edgeIds, layout.edgeRoutes);

  const fileIdToIndex = buildIdIndex(graph.files);
  const fileById = new Map<string, FileNode>();
  for (let i = 0; i < graph.files.length; i++) fileById.set(graph.files[i].id, graph.files[i]);
  const edgeById = new Map<string, FileEdge>();
  for (let i = 0; i < graph.fileEdges.length; i++) edgeById.set(graph.fileEdges[i].id, graph.fileEdges[i]);

  const entry: SpatialCache = {
    fileIndex,
    edgeFilter,
    fileIdToIndex,
    fileById,
    edgeById,
    graphRef: graph,
    // Sized to the current file count so the first frame avoids a
    // subsequent grow. Contents are zero by default (Uint8Array spec).
    visibleFileBitset: new Uint8Array(graph.files.length),
  };
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
  const cache = getSpatialCache(graph, layout);
  const { fileIndex, edgeFilter, fileIdToIndex, fileById, edgeById } = cache;

  // Hot path — every allocation here lands in the per-frame budget. The
  // original implementation allocated two Sets, three `.filter` callbacks,
  // and one `.map` per call (6–30k objects/frame under a fast pan). This
  // rewrite uses:
  //   - rbush items directly (one `.map()` removed)
  //   - O(1) Map hydration (rbush hit → FileNode/FileEdge object)
  //   - a reusable Uint8Array bitset for comment membership (no Set)
  //   - explicit for-loops with pre-sized output arrays (no .filter chains)

  const fileItems = fileIndex.queryItems(canvasRect);
  const files: FileNode[] = new Array(fileItems.length);
  // Keep a parallel fill-count because Map.get may miss if the graph and
  // layout go out of sync mid-frame — we compact into the exact length
  // of survivors at the end instead of leaving `undefined` holes.
  let fileWriteIdx = 0;

  // Zero the bitset and grow if the graph has more files than we've seen.
  // Bitset lives on the per-cache entry (keyed by layout), so concurrent
  // queries against other layouts — e.g. a dual-canvas side-by-side —
  // each use their own buffer and can't race.
  const bitset = (cache.visibleFileBitset = ensureBitsetCapacity(
    cache.visibleFileBitset,
    graph.files.length,
  ));
  // `.fill(0, 0, length)` restricts the clear to the live portion — the
  // bitset may be larger than graph.files.length if it was sized for a
  // previous, bigger graph.
  bitset.fill(0, 0, graph.files.length);

  for (let i = 0; i < fileItems.length; i++) {
    const id = fileItems[i].fileId;
    const node = fileById.get(id);
    if (!node) continue; // graph/layout mismatch (rare; swap in flight)
    files[fileWriteIdx++] = node;
    const idx = fileIdToIndex.get(id);
    if (idx !== undefined) bitset[idx] = 1;
  }
  if (fileWriteIdx !== files.length) files.length = fileWriteIdx;

  const edgeItems = edgeFilter.queryItems(canvasRect);
  const edges: FileEdge[] = new Array(edgeItems.length);
  let edgeWriteIdx = 0;
  for (let i = 0; i < edgeItems.length; i++) {
    const edge = edgeById.get(edgeItems[i].edgeId);
    if (!edge) continue;
    edges[edgeWriteIdx++] = edge;
  }
  if (edgeWriteIdx !== edges.length) edges.length = edgeWriteIdx;

  // Comments: bitset membership (0 allocations for the check itself).
  // Pre-sizing an output array to `graph.comments.length` would usually
  // over-allocate a lot; instead push into a plain array — the garbage
  // churn here is bounded by the visible comment count, not the graph's
  // total comment count.
  const commentsIn = graph.comments;
  const comments: typeof commentsIn = [];
  for (let i = 0; i < commentsIn.length; i++) {
    const c = commentsIn[i];
    const idx = fileIdToIndex.get(c.fileId);
    if (idx !== undefined && bitset[idx] === 1) comments.push(c);
  }

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
