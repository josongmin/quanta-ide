// Shared RBush-backed spatial index for pointer hit-testing in the Pixi
// renderers. Replaces the per-renderer linear scan (O(n) per pointermove) with
// O(log n) queries. At 5000 visible nodes and 60 Hz pointer events, this is
// the difference between 18 ms/frame and a rounding-error budget spent on
// picking.
//
// Usage: the renderer fills a flat array of {x,y,w,h,id} during update() and
// calls load(); pickAt(x, y) returns the topmost id at that point (last one
// inserted wins, to mirror paint order — later items are drawn on top).
//
// Rebuild cadence: we rebuild on every update() because the set of visible
// files and their rects can change on any pan/zoom bucket transition. RBush
// bulk-load is O(n log n) but the constant is tiny (~1 ms for 5000 items),
// so rebuilding beats incremental updates for our access pattern.

import RBush from "rbush";

interface PickItem {
  minX: number;
  minY: number;
  maxX: number;
  maxY: number;
  id: string;
  // Draw order (insertion index). Higher = drawn later = on top.
  z: number;
}

export interface PickRect {
  x: number;
  y: number;
  w: number;
  h: number;
  id: string;
}

export class SpatialPickIndex {
  private tree = new RBush<PickItem>();
  // Reused scratch object for point queries; RBush.search accepts a bbox and
  // allocates internally per call regardless, so keeping this stack-like is
  // purely a micro-win but costs nothing.
  private readonly pointQuery: PickItem = {
    minX: 0, minY: 0, maxX: 0, maxY: 0, id: "", z: 0,
  };

  // Bulk-load N rects. Clears prior state. Caller controls draw-order by
  // array position — later entries win on overlapping picks.
  load(rects: PickRect[]): void {
    this.tree.clear();
    if (rects.length === 0) return;
    const items: PickItem[] = new Array(rects.length);
    for (let i = 0; i < rects.length; i++) {
      const r = rects[i];
      items[i] = {
        minX: r.x,
        minY: r.y,
        maxX: r.x + r.w,
        maxY: r.y + r.h,
        id: r.id,
        z: i,
      };
    }
    this.tree.load(items);
  }

  // Returns the topmost id at (x, y) or null. At galaxy/city LOD rects are
  // non-overlapping (layout guarantees), so z-ordering only matters at
  // cluster LOD or when selection-ring rects are added later.
  pickAt(x: number, y: number): string | null {
    this.pointQuery.minX = x;
    this.pointQuery.maxX = x;
    this.pointQuery.minY = y;
    this.pointQuery.maxY = y;
    const hits = this.tree.search(this.pointQuery);
    if (hits.length === 0) return null;
    let top = hits[0];
    for (let i = 1; i < hits.length; i++) {
      if (hits[i].z > top.z) top = hits[i];
    }
    return top.id;
  }

  clear(): void {
    this.tree.clear();
  }
}
