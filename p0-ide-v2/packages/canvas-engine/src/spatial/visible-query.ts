import type { WorkspaceGraph } from "../graph/types";
import type { WorkspaceLayout } from "../layout/types";
import type { WorkspaceView, Viewport } from "../view/types";
import { FileIndex } from "./file-index";
import { EdgeFilter } from "./edge-filter";

// Returns the portion of graph visible in viewport
export function buildVisibleQuery(
  graph: WorkspaceGraph,
  layout: WorkspaceLayout,
  viewport: Viewport,
): WorkspaceView {
  // 1. Convert viewport screen coords to canvas coords (account for x/y/scale)
  //    Canvas rect = { x: -vp.x/scale, y: -vp.y/scale, w: vp.width/scale, h: vp.height/scale }
  const canvasRect = {
    x: -viewport.x / viewport.scale,
    y: -viewport.y / viewport.scale,
    w: viewport.width / viewport.scale,
    h: viewport.height / viewport.scale,
  };

  // 2. Query file index for visible file IDs
  const fileIndex = new FileIndex();
  fileIndex.load(layout.fileRects);
  const visibleFileIds = new Set(fileIndex.query(canvasRect));

  // 3. Filter graph.files to visible
  const files = graph.files.filter((f) => visibleFileIds.has(f.id));

  // 4. Query edge filter for visible edge IDs
  const edgeFilter = new EdgeFilter();
  const allEdgeIds = graph.fileEdges.map((e) => e.id);
  edgeFilter.load(allEdgeIds, layout.edgeRoutes);
  const visibleEdgeIds = new Set(edgeFilter.query(canvasRect));

  // 5. Filter graph.fileEdges
  const edges = graph.fileEdges.filter((e) => visibleEdgeIds.has(e.id));

  // 6. Filter graph.comments to files that are visible
  const comments = graph.comments.filter((c) => visibleFileIds.has(c.fileId));

  return { files, edges, comments };
}
