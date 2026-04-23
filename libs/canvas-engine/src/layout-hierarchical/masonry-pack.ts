import type { Rect } from "../graph/types";

// Masonry pack (shortest-column)
// --------------------------------------------------------------------
// Variable-size rect packer. Given a list of items with their own
// widths and heights, places them into a uniform-column-width grid,
// always dropping the next item into the currently-shortest column.
//
// This is the same algorithm the legacy `packLeaf` (treemap-layout.ts)
// uses for file cards, generalized to rectangles of any size so the
// hierarchical layout can pack folders-in-packages and packages-in-
// workspace with the same primitive. Column width = max child width;
// shorter children sit left-aligned inside their column (no stretch).
//
// Complexity: O(n log n) for the desc-by-height sort + O(n × cols)
// for the shortest-column scan. At typical fanouts (≤50 children per
// parent) this is trivial even cold.
//
// Column-count heuristic mirrors `packLeaf`: cols ≈ √(aspect · H/W).
// aspect = 1.5 so the packed bounds read "landscape", matching the
// minimap / viewport aspect.

export interface MasonryItem {
  id: string;
  w: number;
  h: number;
}

export interface MasonryPlacement {
  id: string;
  x: number;
  y: number;
  w: number;
  h: number;
}

export interface MasonryResult {
  /** Packed-set bounds. Equals `{x:0,y:0,w,h}` — pack is at origin. */
  w: number;
  h: number;
  /** Column count the packer settled on. Exposed for telemetry. */
  cols: number;
  /** Per-item placements. Positions are relative to pack origin. */
  placements: readonly MasonryPlacement[];
}

const TARGET_ASPECT = 1.5;

export function masonryPack(
  items: readonly MasonryItem[],
  gap = 0,
): MasonryResult {
  const n = items.length;
  if (n === 0) return { w: 0, h: 0, cols: 0, placements: [] };

  // Column width = max child width. Narrower children sit left-aligned
  // inside their column; taller columns than `maxW` are impossible so
  // the column skyline is well-defined.
  let maxW = 0;
  let totalH = 0;
  for (const it of items) {
    if (it.w > maxW) maxW = it.w;
    totalH += it.h;
  }
  if (maxW <= 0) return { w: 0, h: 0, cols: 0, placements: [] };

  // cols² ≈ aspect · H/W. Clamp to [1, n] so tiny sets don't spread.
  const idealCols = Math.sqrt((TARGET_ASPECT * totalH) / maxW);
  const cols = Math.max(1, Math.min(n, Math.round(idealCols) || 1));

  // Desc-by-height: anchor columns with the tallest items first so the
  // skyline stays as flat as possible when smaller items infill.
  const order: number[] = [];
  for (let i = 0; i < n; i++) order.push(i);
  order.sort((a, b) => (items[b]?.h ?? 0) - (items[a]?.h ?? 0));

  const columnTops = new Array<number>(cols).fill(0);
  const placements: MasonryPlacement[] = new Array(n);

  for (const i of order) {
    const it = items[i];
    if (!it) continue;
    // Pick the shortest column. Equal-height ties → leftmost (i=0 wins
    // the initial scan), preserving input order within rows.
    let col = 0;
    let minTop = columnTops[0] ?? 0;
    for (let c = 1; c < cols; c++) {
      const top = columnTops[c] ?? 0;
      if (top < minTop) {
        minTop = top;
        col = c;
      }
    }
    const x = col * (maxW + gap);
    const y = minTop;
    placements[i] = { id: it.id, x, y, w: it.w, h: it.h };
    columnTops[col] = y + it.h + gap;
  }

  const packedW = cols * maxW + (cols - 1) * gap;
  let tallest = 0;
  for (const top of columnTops) if (top > tallest) tallest = top;
  // Trim the trailing `+gap` that the last item in each column added.
  const packedH = Math.max(0, tallest - gap);
  return { w: packedW, h: packedH, cols, placements };
}

/** Axis-aligned union of positioned rects. Convenience for callers
 *  that need `totalBounds` after packing top-level siblings. */
export function unionRects(rects: readonly Rect[]): Rect {
  if (rects.length === 0) return { x: 0, y: 0, w: 0, h: 0 };
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const r of rects) {
    if (r.x < minX) minX = r.x;
    if (r.y < minY) minY = r.y;
    if (r.x + r.w > maxX) maxX = r.x + r.w;
    if (r.y + r.h > maxY) maxY = r.y + r.h;
  }
  return { x: minX, y: minY, w: maxX - minX, h: maxY - minY };
}
