import type { FileEdge } from "../graph/types";
import type { Rect } from "../graph/types";
import type { WorkspaceLayout, BezierRoute } from "../layout/types";

export interface BezierGeometry extends BezierRoute {
  bbox: Rect;
}

export class EdgeGeometryCache {
  private cache = new Map<string, BezierGeometry>();

  build(edges: FileEdge[], layout: WorkspaceLayout): void {
    this.cache.clear();
    for (const edge of edges) {
      const route = layout.edgeRoutes.get(edge.id);
      if (!route) continue;
      this.cache.set(edge.id, { ...route, bbox: computeBBox(route) });
    }
  }

  get(edgeId: string): BezierGeometry | undefined {
    return this.cache.get(edgeId);
  }

  clear(): void { this.cache.clear(); }
}

function computeBBox(r: BezierRoute): Rect {
  const xs = [r.x1, r.cx1, r.cx2, r.x2];
  const ys = [r.y1, r.cy1, r.cy2, r.y2];
  const minX = Math.min(...xs);
  const minY = Math.min(...ys);
  return { x: minX, y: minY, w: Math.max(...xs) - minX, h: Math.max(...ys) - minY };
}
