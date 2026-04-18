import { Graphics, Container } from "pixi.js";
import type { FileEdge, WorkspaceLayout, Viewport } from "@quanta/canvas-engine";
import type { EdgeGeometryCache } from "@quanta/canvas-engine";
import { EDGE_STYLE } from "./shared/colors";

// Static edges are redrawn via Graphics because the per-edge geometry is
// entirely cached in EdgeGeometryCache; the clear+replay cost dominates
// only when the edge set changes. We short-circuit the degenerate
// empty → empty path (toggling edges off and panning) so we don't issue
// Graphics.clear()+no-op redraw on every render.
//
// Visibility note: stroke `width` is in WORLD pixels, so at low viewport.scale
// a world-width of 1 translates to sub-pixel screen stroke (0.5 scale → 0.5
// screen px → invisible). Callers pass the current scale and we compute an
// inverse-scale multiplier that keeps strokes ≥1.5 screen px — otherwise
// zooming out makes all edges vanish.
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

  build(
    edges: FileEdge[],
    layout: WorkspaceLayout,
    cache?: EdgeGeometryCache,
    viewport?: Viewport,
    opts?: { kindFilter?: Partial<Record<FileEdge["kind"], boolean>>; widthMul?: number },
  ): void {
    // Fast path: nothing to draw and nothing was drawn last frame. Avoid
    // triggering Graphics.clear() → geometry rebuild → GL state churn.
    if (edges.length === 0 && this.previousLength === 0) return;

    // Scale-independent stroke — world width chosen so the rendered stroke
    // stays ≥1.5 screen px regardless of zoom. `invScale = 1 / viewport.scale`
    // is clamped to avoid runaway widths at extreme zoom-out (where edges
    // would otherwise become bold world-wide stripes).
    const scale = viewport?.scale ?? 1;
    const invScale = Math.min(32, Math.max(1, 1 / scale));
    const widthMul = opts?.widthMul ?? 1;
    const kindFilter = opts?.kindFilter;

    this.gfx.clear();
    let drawn = 0;
    for (const edge of edges) {
      if (kindFilter && kindFilter[edge.kind] === false) continue;
      const route = cache?.get(edge.id) ?? layout.edgeRoutes.get(edge.id);
      if (!route) continue;

      const style = EDGE_STYLE[edge.kind];
      const width = style.baseWidth * invScale * widthMul;

      this.gfx
        .moveTo(route.x1, route.y1)
        .bezierCurveTo(route.cx1, route.cy1, route.cx2, route.cy2, route.x2, route.y2)
        .stroke({ color: style.color, alpha: style.alpha, width });
      drawn++;
    }
    this.previousLength = drawn;
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
