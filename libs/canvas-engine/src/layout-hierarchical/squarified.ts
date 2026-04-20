import type { Rect } from "../graph/types";

// Squarified treemap
// --------------------------------------------------------------------
// Classic Bruls/Huijsen/van Wijk (1999) algorithm: pack N rectangles
// with given weights into a parent rect such that each child's aspect
// ratio stays as close to 1 as possible. The tier ladder mounts this
// at every level of the Entity tree, giving a layout where ancestors
// contain their descendants by construction.
//
// Why not the existing `treemap-layout.ts` implementation:
//   - That one builds a file-level layout with FIXED-SIZE FileNode
//     cards (width/height chosen from LoC). Great for the legacy
//     workspace-canvas where every tier shows the same file cards
//     at different zooms; wrong for hierarchical rendering where a
//     'galaxy' rect needs to resize to fit its children at ANY scale.
//   - Sharing code would mean threading "fixed vs flexible" as a
//     mode flag through the whole algorithm. Cleaner to have a
//     second implementation specialised for flexible rects.
//
// Complexity: O(n log n) per level (sort by weight). At 10k files
// across ~20 packages × ~50 dirs, total work ≈ 10k log(10k) ≈ 130k
// comparisons — well under a frame budget even cold.

interface Item {
  id: string;
  weight: number;
}

/**
 * Pack `items` into `bounds`, returning a child-id → rect map.
 * Order of items doesn't matter; internally sorted by weight desc
 * (standard squarified heuristic).
 */
export function squarifyInto(
  items: readonly Item[],
  bounds: Rect,
  padding: number,
  gap: number = 0,
): Map<string, Rect> {
  const out = new Map<string, Rect>();
  if (items.length === 0) return out;
  if (bounds.w <= padding * 2 || bounds.h <= padding * 2) {
    // Not enough room to pad — give each item the full bounds and
    // let the caller decide whether to render them overlapped.
    for (const it of items) out.set(it.id, bounds);
    return out;
  }

  // Inner rect after padding.
  const inner: Rect = {
    x: bounds.x + padding,
    y: bounds.y + padding,
    w: bounds.w - padding * 2,
    h: bounds.h - padding * 2,
  };

  const totalW = items.reduce((s, it) => s + it.weight, 0);
  if (totalW <= 0) {
    // Equal split fallback when weights are all zero (synthetic
    // trees without metrics). Avoids a divide-by-zero and still
    // gives the user a navigable layout.
    const eq = 1 / items.length;
    return squarifyInto(
      items.map(it => ({ id: it.id, weight: eq })),
      bounds,
      padding,
    );
  }

  // Normalise weights to inner.area so each child's area is
  // proportional to its weight. squarified operates in area-space
  // throughout, converting back to w/h via the rolling bar at the
  // end of each row.
  const areaPerUnit = (inner.w * inner.h) / totalW;
  const areas = items
    .map(it => ({ id: it.id, a: it.weight * areaPerUnit }))
    .sort((a, b) => b.a - a.a);

  // Rolling "bar" — the unfilled sub-rect. Rows consume the bar's
  // short side until worst-case aspect would worsen, then flush.
  let bar: Rect = { ...inner };
  let row: { id: string; a: number }[] = [];
  let rowSum = 0;

  const short = (r: Rect) => Math.min(r.w, r.h);

  // Worst-aspect-ratio of a prospective row. Lower is better. If
  // adding `nextArea` makes it worse we flush the current row.
  const worstAspect = (
    rowAreas: number[],
    sum: number,
    barShort: number,
  ): number => {
    if (rowAreas.length === 0) return Number.POSITIVE_INFINITY;
    const side = sum / barShort;
    let worst = 0;
    for (const a of rowAreas) {
      const long = a / side;
      const ratio = Math.max(side / long, long / side);
      if (ratio > worst) worst = ratio;
    }
    return worst;
  };

  const flushRow = () => {
    if (row.length === 0) return;
    const short0 = short(bar);
    const long = rowSum / short0; // along bar's LONG side
    const horizontal = bar.w >= bar.h;
    if (horizontal) {
      // Row stacks vertically along the left edge, consuming `long`
      // of width.
      let cursorY = bar.y;
      for (const r of row) {
        const h = (r.a / rowSum) * bar.h;
        out.set(r.id, { x: bar.x, y: cursorY, w: long, h });
        cursorY += h;
      }
      bar = { x: bar.x + long, y: bar.y, w: bar.w - long, h: bar.h };
    } else {
      // Row stacks horizontally along the top edge, consuming `long`
      // of height.
      let cursorX = bar.x;
      for (const r of row) {
        const w = (r.a / rowSum) * bar.w;
        out.set(r.id, { x: cursorX, y: bar.y, w, h: long });
        cursorX += w;
      }
      bar = { x: bar.x, y: bar.y + long, w: bar.w, h: bar.h - long };
    }
    row = [];
    rowSum = 0;
  };

  for (const item of areas) {
    const candidateSum = rowSum + item.a;
    const rowAreas = row.map(r => r.a);
    const curWorst = worstAspect(rowAreas, rowSum, short(bar));
    const nextWorst = worstAspect([...rowAreas, item.a], candidateSum, short(bar));
    if (nextWorst <= curWorst || row.length === 0) {
      row.push(item);
      rowSum = candidateSum;
    } else {
      flushRow();
      row.push(item);
      rowSum = item.a;
    }
  }
  flushRow();

  if (gap > 0) {
    // Shrink each child symmetrically — on edges shared with a sibling
    // this carves out a `gap`-wide gutter between the two; on edges
    // flush with `inner` we just trade a bit more breathing room
    // against the parent's padding, which is fine visually. Skip
    // entries that would collapse to zero (happens when `gap` exceeds
    // the smallest rect's short side on a crowded parent).
    const half = gap / 2;
    for (const [id, r] of out) {
      const w = r.w - gap;
      const h = r.h - gap;
      if (w <= 1 || h <= 1) continue;
      out.set(id, { x: r.x + half, y: r.y + half, w, h });
    }
  }

  return out;
}
