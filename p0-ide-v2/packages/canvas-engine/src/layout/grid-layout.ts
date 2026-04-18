import type { WorkspaceGraph } from "../graph/types";
import type { WorkspaceLayout, BezierRoute } from "./types";
import {
  FILE_CARD_W,
  FILE_CARD_H,
  GRID_GAP_X,
  GRID_GAP_H,
  GRID_COLS,
} from "./types";
import { computeWorkspaceMetrics } from "../graph/metrics";

export function gridLayout(graph: WorkspaceGraph): WorkspaceLayout {
  const fileRects = new Map<string, { x: number; y: number; w: number; h: number }>();

  // Position files in a grid, left-to-right, top-to-bottom
  for (let i = 0; i < graph.files.length; i++) {
    const file = graph.files[i];
    const col = i % GRID_COLS;
    const row = Math.floor(i / GRID_COLS);
    fileRects.set(file.id, {
      x: col * (FILE_CARD_W + GRID_GAP_X),
      y: row * (FILE_CARD_H + GRID_GAP_H),
      w: FILE_CARD_W,
      h: FILE_CARD_H,
    });
  }

  // Build straight bezier routes: right-center of source to left-center of target
  const edgeRoutes = new Map<string, BezierRoute>();
  for (const edge of graph.fileEdges) {
    const fromRect = fileRects.get(edge.from);
    const toRect   = fileRects.get(edge.to);
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

  // Empty aggregate cache
  const aggregates = {
    commentsByFunction: new Map<string, number>(),
    commentsByFile: new Map<string, number>(),
    commentedLines: new Map<string, Set<number>>(),
  };

  // Compute total bounds from all rects + 48px padding
  const PADDING = 48;
  let maxX = 0;
  let maxY = 0;
  for (const rect of fileRects.values()) {
    const rx = rect.x + rect.w;
    const ry = rect.y + rect.h;
    if (rx > maxX) maxX = rx;
    if (ry > maxY) maxY = ry;
  }

  const totalBounds = {
    x: 0,
    y: 0,
    w: maxX + PADDING,
    h: maxY + PADDING,
  };

  // Metrics are cheap enough at grid scale that we always compute them —
  // gridLayout is used for ≤TREEMAP_THRESHOLD files (≤100 by default),
  // so Brandes runs exactly in under a millisecond.
  const metrics = computeWorkspaceMetrics(graph, { computeBetweenness: true });

  return { fileRects, edgeRoutes, aggregates, totalBounds, metrics };
}
