import { Graphics, Container } from "pixi.js";
import type { FileEdge, WorkspaceLayout } from "@quanta/canvas-engine";
import type { EdgeGeometryCache } from "@quanta/canvas-engine";

// Static edges are redrawn via Graphics because the per-edge geometry is
// entirely cached in EdgeGeometryCache; the clear+replay cost dominates
// only when the edge set changes. We short-circuit the degenerate
// empty → empty path (toggling edges off and panning) so we don't issue
// Graphics.clear()+no-op redraw on every render.
//
// Moving to an instanced bezier-SDF mesh (one quad per edge, fragment shader
// evaluates B(t) and outputs alpha by distance-to-curve) is the SOTA path and
// would collapse this to one draw call for thousands of edges. Out of scope
// for this pass — the hot problem at 5000 nodes is node-redraw cost, not
// edges (edges are culled by the orchestrator before reaching this renderer).

export class EdgeStaticRenderer {
  private gfx: Graphics;
  private previousLength = 0;

  constructor(parent: Container) {
    this.gfx = new Graphics();
    parent.addChildAt(this.gfx, 0); // behind everything
  }

  build(edges: FileEdge[], layout: WorkspaceLayout, cache?: EdgeGeometryCache): void {
    // Fast path: nothing to draw and nothing was drawn last frame. Avoid
    // triggering Graphics.clear() → geometry rebuild → GL state churn.
    if (edges.length === 0 && this.previousLength === 0) return;

    this.gfx.clear();
    for (const edge of edges) {
      const route = cache?.get(edge.id) ?? layout.edgeRoutes.get(edge.id);
      if (!route) continue;

      const color = edge.kind === "taint-propagation" ? 0xe53e3e : 0x9ca3af;
      const alpha = edge.kind === "taint-propagation" ? 0.55 : 0.25;
      const width = edge.kind === "taint-propagation" ? 1.5 : 0.8;

      this.gfx
        .moveTo(route.x1, route.y1)
        .bezierCurveTo(route.cx1, route.cy1, route.cx2, route.cy2, route.x2, route.y2)
        .stroke({ color, alpha, width });
    }
    this.previousLength = edges.length;
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
