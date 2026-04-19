import { Graphics, Container } from "pixi.js";
import type { ViewState, WorkspaceLayout } from "@quanta/canvas-engine";
import type { EdgeGeometryCache } from "@quanta/canvas-engine";

export class EdgeOverlayRenderer {
  private gfx: Graphics;

  constructor(parent: Container) {
    this.gfx = new Graphics();
    parent.addChild(this.gfx);
  }

  update(viewState: ViewState, layout: WorkspaceLayout, cache?: EdgeGeometryCache): void {
    this.gfx.clear();

    const hovered = viewState.hoveredEdgeId;
    if (hovered && hovered !== viewState.selectedEdgeId) {
      const route = cache?.get(hovered) ?? layout.edgeRoutes.get(hovered);
      if (route) {
        this.gfx
          .moveTo(route.x1, route.y1)
          .bezierCurveTo(route.cx1, route.cy1, route.cx2, route.cy2, route.x2, route.y2)
          .stroke({ color: 0x6366f1, alpha: 0.7, width: 4 });
      }
    }

    const selected = viewState.selectedEdgeId;
    if (!selected) return;

    const route = cache?.get(selected) ?? layout.edgeRoutes.get(selected);
    if (!route) return;

    this.gfx
      .moveTo(route.x1, route.y1)
      .bezierCurveTo(route.cx1, route.cy1, route.cx2, route.cy2, route.x2, route.y2)
      .stroke({ color: 0x4f46e5, alpha: 0.95, width: 2.5 });

    const dx = route.x2 - route.cx2;
    const dy = route.y2 - route.cy2;
    const angle = Math.atan2(dy, dx);
    const AL = 8;
    const AW = Math.PI / 7;

    this.gfx
      .moveTo(route.x2, route.y2)
      .lineTo(
        route.x2 - AL * Math.cos(angle - AW),
        route.y2 - AL * Math.sin(angle - AW),
      )
      .moveTo(route.x2, route.y2)
      .lineTo(
        route.x2 - AL * Math.cos(angle + AW),
        route.y2 - AL * Math.sin(angle + AW),
      )
      .stroke({ color: 0x4f46e5, alpha: 0.95, width: 2 });
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
