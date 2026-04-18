import type { WorkspaceGraph } from "../graph/types";
import type { WorkspaceLayout } from "../layout/types";
import type { WorkspaceView, Viewport } from "../view/types";
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

// Returns the portion of graph visible in viewport
export function buildVisibleQuery(
  graph: WorkspaceGraph,
  layout: WorkspaceLayout,
  viewport: Viewport,
): WorkspaceView {
  // Convert viewport screen coords to canvas coords
  const canvasRect = {
    x: -viewport.x / viewport.scale,
    y: -viewport.y / viewport.scale,
    w: viewport.width / viewport.scale,
    h: viewport.height / viewport.scale,
  };

  const { fileIndex, edgeFilter } = getSpatialCache(graph, layout);

  const visibleFileIds = new Set(fileIndex.query(canvasRect));
  const files = graph.files.filter((f) => visibleFileIds.has(f.id));

  const visibleEdgeIds = new Set(edgeFilter.query(canvasRect));
  const edges = graph.fileEdges.filter((e) => visibleEdgeIds.has(e.id));

  const comments = graph.comments.filter((c) => visibleFileIds.has(c.fileId));

  return { files, edges, comments };
}
