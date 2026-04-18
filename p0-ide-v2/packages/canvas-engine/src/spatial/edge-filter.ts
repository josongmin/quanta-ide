import RBush from "rbush";
import type { BezierRoute } from "../layout/types";

interface EdgeBBoxItem {
  readonly minX: number;
  readonly minY: number;
  readonly maxX: number;
  readonly maxY: number;
  readonly edgeId: string;
}

// Internal mutable variant — see file-index.ts for rationale. rbush mutates
// bbox fields only during `load()`; external consumers receive readonly views.
type MutableEdgeBBoxItem = { -readonly [K in keyof EdgeBBoxItem]: EdgeBBoxItem[K] };

function bezierBBox(route: BezierRoute): { minX: number; minY: number; maxX: number; maxY: number } {
  const xs = [route.x1, route.cx1, route.cx2, route.x2];
  const ys = [route.y1, route.cy1, route.cy2, route.y2];
  return {
    minX: Math.min(...xs),
    minY: Math.min(...ys),
    maxX: Math.max(...xs),
    maxY: Math.max(...ys),
  };
}

export class EdgeFilter {
  private tree = new RBush<EdgeBBoxItem>();

  load(edgeIds: string[], edgeRoutes: Map<string, BezierRoute>): void {
    this.tree.clear();
    const items: MutableEdgeBBoxItem[] = [];
    for (const edgeId of edgeIds) {
      const route = edgeRoutes.get(edgeId);
      if (!route) continue;
      const bbox = bezierBBox(route);
      items.push({ ...bbox, edgeId });
    }
    this.tree.load(items);
  }

  query(viewport: { x: number; y: number; w: number; h: number }): string[] {
    const results = this.tree.search({
      minX: viewport.x,
      minY: viewport.y,
      maxX: viewport.x + viewport.w,
      maxY: viewport.y + viewport.h,
    });
    return results.map((item) => item.edgeId);
  }

  /**
   * Hot-path variant — returns the raw bbox items (each carries `edgeId`)
   * so callers can skip the extra `.map()` allocation.
   */
  queryItems(viewport: { x: number; y: number; w: number; h: number }): ReadonlyArray<Readonly<EdgeBBoxItem>> {
    return this.tree.search({
      minX: viewport.x,
      minY: viewport.y,
      maxX: viewport.x + viewport.w,
      maxY: viewport.y + viewport.h,
    });
  }

  clear(): void {
    this.tree.clear();
  }
}

export type { EdgeBBoxItem };
