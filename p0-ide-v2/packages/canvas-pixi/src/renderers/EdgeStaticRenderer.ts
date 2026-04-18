import { Graphics, Container } from "pixi.js";
import type { FileEdge, WorkspaceLayout } from "@quanta/canvas-engine";
import type { EdgeGeometryCache } from "@quanta/canvas-engine";

export class EdgeStaticRenderer {
  private gfx: Graphics;

  constructor(parent: Container) {
    this.gfx = new Graphics();
    parent.addChildAt(this.gfx, 0); // behind everything
  }

  build(edges: FileEdge[], layout: WorkspaceLayout, cache?: EdgeGeometryCache): void {
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
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
