import type { Rect, FileEdge } from "../graph/types";
import type { OrthogonalRoute } from "./types";

/**
 * Orthogonal edge routing — produces L-shaped / Z-shaped poly-lines
 * instead of long bezier curves. Matches IDE-style flow diagrams
 * (e.g. GoJS, JointJS, Draw.io) which are SOTA for treemap + call graph
 * visualizations where edges cross clustered boxes.
 *
 * Path selection:
 *   - If the two rects are horizontally separated (to.x ≥ from.x + from.w):
 *       from-right → corridor X (midpoint between from-right and to-left)
 *       → corridor Y = to.y center. If the corridor is wide, this degenerates
 *       into two 90° corners ("Z" staircase). If same Y, the middle run is a
 *       straight horizontal (still emitted as three-point poly for uniform
 *       consumer code).
 *   - Else if vertically separated (to.y above/below from): two 90° corners
 *     via a vertical corridor.
 *   - Else (overlap): fall back to a straight 2-point line from midpoint to
 *     midpoint. Renderers can choose to hide these or dim them.
 *
 * We emit poly-lines as {points: [{x,y},...]}. The first/last points always
 * anchor on the rect *edge* (not the center) so renderers can draw an
 * arrowhead without overlap.
 */

const MIN_CORRIDOR = 40;

function rectCenter(r: Rect): { x: number; y: number } {
  return { x: r.x + r.w / 2, y: r.y + r.h / 2 };
}

/**
 * Produce an orthogonal (poly-line) route between two file rects.
 * Returns null if both rects have zero size (degenerate).
 */
export function orthogonalRoute(from: Rect, to: Rect): OrthogonalRoute | null {
  if (from.w <= 0 || from.h <= 0 || to.w <= 0 || to.h <= 0) return null;

  const fromC = rectCenter(from);
  const toC = rectCenter(to);

  // Horizontal gap (positive if `to` is to the right of `from`, negative if left).
  const rightGap = to.x - (from.x + from.w);
  const leftGap = from.x - (to.x + to.w);
  // Vertical gap.
  const belowGap = to.y - (from.y + from.h);
  const aboveGap = from.y - (to.y + to.h);

  // Case 1: horizontal separation (either direction).
  if (rightGap >= 0 || leftGap >= 0) {
    const toRight = rightGap >= 0;
    const x1 = toRight ? from.x + from.w : from.x;
    const y1 = fromC.y;
    const x2 = toRight ? to.x : to.x + to.w;
    const y2 = toC.y;
    // Midpoint X corridor.
    const corridorX = toRight
      ? x1 + Math.max(rightGap / 2, MIN_CORRIDOR)
      : x1 - Math.max(leftGap / 2, MIN_CORRIDOR);
    // If Ys are basically aligned, emit a straight three-point path so
    // consumers don't special-case the "flat" edge.
    if (Math.abs(y2 - y1) < 1) {
      return { points: [{ x: x1, y: y1 }, { x: corridorX, y: y1 }, { x: x2, y: y2 }] };
    }
    return {
      points: [
        { x: x1, y: y1 },
        { x: corridorX, y: y1 },
        { x: corridorX, y: y2 },
        { x: x2, y: y2 },
      ],
    };
  }

  // Case 2: vertical separation — two corners through a Y corridor.
  if (belowGap >= 0 || aboveGap >= 0) {
    const toBelow = belowGap >= 0;
    const x1 = fromC.x;
    const y1 = toBelow ? from.y + from.h : from.y;
    const x2 = toC.x;
    const y2 = toBelow ? to.y : to.y + to.h;
    const corridorY = toBelow
      ? y1 + Math.max(belowGap / 2, MIN_CORRIDOR)
      : y1 - Math.max(aboveGap / 2, MIN_CORRIDOR);
    if (Math.abs(x2 - x1) < 1) {
      return { points: [{ x: x1, y: y1 }, { x: x1, y: corridorY }, { x: x2, y: y2 }] };
    }
    return {
      points: [
        { x: x1, y: y1 },
        { x: x1, y: corridorY },
        { x: x2, y: corridorY },
        { x: x2, y: y2 },
      ],
    };
  }

  // Case 3: rects overlap — degenerate. Emit center-to-center straight line.
  return { points: [{ x: fromC.x, y: fromC.y }, { x: toC.x, y: toC.y }] };
}

/**
 * Batch-build orthogonal routes for every edge. Indexed by edge id so
 * consumers can look up alongside the existing `edgeRoutes` (bezier).
 *
 * Edges with missing endpoints are silently skipped (same behavior as
 * gridLayout / treemapLayout bezier pass).
 */
export function buildOrthogonalRoutes(
  edges: FileEdge[],
  fileRects: Map<string, Rect>,
): Map<string, OrthogonalRoute> {
  const out = new Map<string, OrthogonalRoute>();
  for (const edge of edges) {
    const from = fileRects.get(edge.from);
    const to = fileRects.get(edge.to);
    if (!from || !to) continue;
    const route = orthogonalRoute(from, to);
    if (route) out.set(edge.id, route);
  }
  return out;
}
