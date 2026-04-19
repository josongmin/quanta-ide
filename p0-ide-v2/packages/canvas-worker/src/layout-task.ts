import type { WorkspaceGraph, WorkspaceLayout, BezierRoute } from "@quanta/canvas-engine";
import type { LayoutStrategy } from "./messages";
import { treemapLayout, FILE_CARD_W, FILE_CARD_H } from "@quanta/canvas-engine";

/**
 * Kept for backwards-compat with callers that still import the name. Layout
 * no longer branches on it — we always use treemap so that files are grouped
 * by directory hierarchy at every LOD tier (city/street/ground). Grid was
 * flat and hid the folder structure.
 */
export const TREEMAP_THRESHOLD = 0;

export async function runLayoutTask(
  graph: WorkspaceGraph,
  strategy: LayoutStrategy,
  pinnedNodes?: Record<string, { x: number; y: number; w: number; h: number }>,
): Promise<WorkspaceLayout> {
  const baseResult = treemapLayout(graph);

  if (strategy === "grid") {
    return baseResult;
  }

  // "grid-then-elk": attempt ELK layout, fall back to base on failure
  try {
    return await elkLayout(graph, baseResult, pinnedNodes);
  } catch {
    return baseResult;
  }
}

// Sync layout — exported so the worker can send an immediate LAYOUT_READY
// before (optionally) following up with a slower refinement pass. Always
// treemap so folder hierarchy is preserved even on small graphs.
export function runGridLayout(graph: WorkspaceGraph): WorkspaceLayout {
  return treemapLayout(graph);
}

/**
 * Directory-based squarified treemap layout. Yields a near-square total
 * bounds with per-directory cluster rects, letting the supergalaxy LOD
 * render a tiny number of boxes instead of thousands of file cards.
 */
export function runTreemapLayout(graph: WorkspaceGraph): WorkspaceLayout {
  return treemapLayout(graph);
}

// ELK layered layout — expensive. The worker gates this behind a node-count
// threshold so giant graphs (5000+ nodes) don't hang or exhaust memory.
export async function runElkLayout(
  graph: WorkspaceGraph,
  gridFallback: WorkspaceLayout,
  pinnedNodes?: Record<string, { x: number; y: number; w: number; h: number }>,
): Promise<WorkspaceLayout> {
  return elkLayout(graph, gridFallback, pinnedNodes);
}

async function elkLayout(
  graph: WorkspaceGraph,
  gridFallback: WorkspaceLayout,
  pinnedNodes?: Record<string, { x: number; y: number; w: number; h: number }>,
): Promise<WorkspaceLayout> {
  const elkModule = (await import("elkjs/lib/elk.bundled.js")) as {
    default: new () => { layout(graph: unknown): Promise<unknown> };
  };
  const ELK = elkModule.default;

  const elk = new ELK();

  const elkGraph = {
    id: "root",
    layoutOptions: {
      "elk.algorithm": "layered",
      "elk.direction": "RIGHT",
      "elk.layered.spacing.nodeNodeBetweenLayers": "200",
      "elk.spacing.nodeNode": "60",
    },
    children: graph.files.map(f => ({
      id: f.id,
      width: FILE_CARD_W,
      height: FILE_CARD_H,
      ...(pinnedNodes?.[f.id]
        ? {
            x: pinnedNodes[f.id].x,
            y: pinnedNodes[f.id].y,
            layoutOptions: { "elk.fixed": "COORDINATES" },
          }
        : {}),
    })),
    edges: graph.fileEdges.map(e => ({
      id: e.id,
      sources: [e.from],
      targets: [e.to],
    })),
  };

  const laid = await elk.layout(elkGraph) as {
    children?: { id: string; x?: number; y?: number; width?: number; height?: number }[];
  };

  // Build fileRects from ELK node positions
  const fileRects = new Map<string, { x: number; y: number; w: number; h: number }>();
  for (const node of laid.children ?? []) {
    fileRects.set(node.id, {
      x: node.x ?? 0,
      y: node.y ?? 0,
      w: node.width ?? FILE_CARD_W,
      h: node.height ?? FILE_CARD_H,
    });
  }

  // Build edge routes as simple bezier (same formula as gridLayout)
  const edgeRoutes = new Map<string, BezierRoute>();
  for (const edge of graph.fileEdges) {
    const fromRect = fileRects.get(edge.from);
    const toRect = fileRects.get(edge.to);
    if (!fromRect || !toRect) continue;

    const x1 = fromRect.x + fromRect.w;
    const y1 = fromRect.y + fromRect.h / 2;
    const x2 = toRect.x;
    const y2 = toRect.y + toRect.h / 2;
    const dx = (x2 - x1) * 0.4;

    edgeRoutes.set(edge.id, {
      x1,
      y1,
      cx1: x1 + dx,
      cy1: y1,
      cx2: x2 - dx,
      cy2: y2,
      x2,
      y2,
    });
  }

  // Empty aggregate cache (aggregates are built by a separate task)
  const aggregates = {
    commentsByFunction: new Map<string, number>(),
    commentsByFile: new Map<string, number>(),
    commentedLines: new Map<string, Set<number>>(),
  };

  // Compute total bounds
  const PADDING = 48;
  let maxX = 0;
  let maxY = 0;
  for (const rect of fileRects.values()) {
    const rx = rect.x + rect.w;
    const ry = rect.y + rect.h;
    if (rx > maxX) maxX = rx;
    if (ry > maxY) maxY = ry;
  }

  // If ELK returned no nodes, fall back to grid bounds
  if (fileRects.size === 0) {
    return gridFallback;
  }

  const totalBounds = { x: 0, y: 0, w: maxX + PADDING, h: maxY + PADDING };

  return { fileRects, edgeRoutes, aggregates, totalBounds };
}
