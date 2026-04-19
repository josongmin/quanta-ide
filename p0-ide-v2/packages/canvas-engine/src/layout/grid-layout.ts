import type { WorkspaceGraph } from "../graph/types";
import type { WorkspaceLayout, BezierRoute } from "./types";
import {
  FILE_CARD_W,
  GRID_GAP_X,
  GRID_GAP_H,
  GRID_COLS,
  computeFileHeight,
} from "./types";
import { enrichLayout } from "./enrich-layout";

/**
 * Greedy-balanced column packer. Each file card takes a height proportional
 * to its LOC count (see `computeFileHeight`) so the ground tier renders a
 * paper-like skyline — long files read long, short files stay compact.
 *
 * Column count follows the legacy `GRID_COLS` constant so downstream callers
 * (worker bounds estimation, tests that snapshot x-coords at multiples of
 * `FILE_CARD_W + GRID_GAP_X`) keep the same horizontal rhythm. The packer
 * only changes y — each file goes to whichever column currently has the
 * smallest cumulative height, minimising the ragged bottom edge.
 */
export function gridLayout(graph: WorkspaceGraph): WorkspaceLayout {
  const fileRects = new Map<string, { x: number; y: number; w: number; h: number }>();

  // Column count: cap at GRID_COLS, but never more columns than files.
  const nCols = Math.max(1, Math.min(GRID_COLS, graph.files.length));
  const columnTops: number[] = new Array(nCols).fill(0);

  for (const file of graph.files) {
    const h = computeFileHeight(file.loc ?? 0);

    // Pick the shortest column (ties → left-most for stable output).
    let col = 0;
    let minTop = columnTops[0];
    for (let c = 1; c < nCols; c++) {
      if (columnTops[c] < minTop) {
        minTop = columnTops[c];
        col = c;
      }
    }

    const x = col * (FILE_CARD_W + GRID_GAP_X);
    const y = columnTops[col];
    fileRects.set(file.id, { x, y, w: FILE_CARD_W, h });
    columnTops[col] = y + h + GRID_GAP_H;
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
  const enriched = enrichLayout(graph);

  return { fileRects, edgeRoutes, aggregates, totalBounds, ...enriched };
}
