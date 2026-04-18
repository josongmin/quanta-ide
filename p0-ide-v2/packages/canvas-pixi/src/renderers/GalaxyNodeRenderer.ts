import { Graphics, Container, FederatedPointerEvent } from "pixi.js";
import type { FileNode, WorkspaceLayout, ViewState, Viewport } from "@quanta/canvas-engine";

// Galaxy LOD (scale < 0.15): the user is looking at the whole codebase from
// far away. Each file card is tens of CSS pixels — text would be unreadable
// regardless of how we render it. This renderer is deliberately stripped to
// rectangles-only so that 5000+ files can be drawn without per-file Text
// textures (which would otherwise be the dominant cost — ~5× slower than the
// geometry itself at galaxy zoom).

function riskFill(score: number): number {
  if (score >= 70) return 0xfee2e2;
  if (score >= 40) return 0xfef3c7;
  return 0xdcfce7;
}

function riskBorder(score: number): number {
  if (score >= 70) return 0xfca5a5;
  if (score >= 40) return 0xfcd34d;
  return 0x86efac;
}

export class GalaxyNodeRenderer {
  private container: Container;
  private bgGfx: Graphics;
  private hitLayer: Graphics; // single graphics with per-file hit regions
  private hitByPoint: Array<{ x: number; y: number; w: number; h: number; id: string }> = [];

  private onClickFile?: (fileId: string) => void;
  private onHoverFile?: (fileId: string | null) => void;

  constructor(
    parent: Container,
    opts?: {
      onClick?: (fileId: string) => void;
      onHover?: (fileId: string | null) => void;
    },
  ) {
    this.container = new Container();
    this.bgGfx = new Graphics();
    this.hitLayer = new Graphics();
    this.onClickFile = opts?.onClick;
    this.onHoverFile = opts?.onHover;

    this.container.addChild(this.bgGfx);
    // Single invisible hit layer for the whole renderer — one eventMode:static
    // Graphics handling many files is vastly cheaper than one per file.
    this.hitLayer.eventMode = "static";
    this.hitLayer.cursor = "pointer";
    this.hitLayer.on("pointertap", (e: FederatedPointerEvent) => {
      const hit = this.pickAt(e.global.x, e.global.y);
      if (hit) this.onClickFile?.(hit);
    });
    this.hitLayer.on("pointermove", (e: FederatedPointerEvent) => {
      const hit = this.pickAt(e.global.x, e.global.y);
      this.onHoverFile?.(hit ?? null);
    });
    this.hitLayer.on("pointerout", () => this.onHoverFile?.(null));
    this.container.addChild(this.hitLayer);

    parent.addChild(this.container);
  }

  private pickAt(globalX: number, globalY: number): string | null {
    // Transform global → world coords via container's inverse transform.
    const local = this.container.toLocal({ x: globalX, y: globalY });
    // Linear scan (O(n)). At galaxy LOD n ≈ 5000; a sub-ms tax on hover.
    // If this shows up in profiles, swap for a local RBush.
    for (let i = this.hitByPoint.length - 1; i >= 0; i--) {
      const r = this.hitByPoint[i];
      if (local.x >= r.x && local.x <= r.x + r.w && local.y >= r.y && local.y <= r.y + r.h) {
        return r.id;
      }
    }
    return null;
  }

  update(files: FileNode[], layout: WorkspaceLayout, viewState: ViewState, viewport: Viewport): void {
    const invScale = Math.min(8, Math.max(0.5, 1 / viewport.scale));
    const strokeW = invScale;

    this.bgGfx.clear();
    this.hitLayer.clear();
    this.hitByPoint.length = 0;

    for (const file of files) {
      const rect = layout.fileRects.get(file.id);
      if (!rect) continue;

      const isSelected = viewState.selectedFileId === file.id;
      const isHovered = viewState.hoveredFileId === file.id;

      const fillColor = riskFill(file.riskScore);
      const borderColor = riskBorder(file.riskScore);
      const fillAlpha = isSelected ? 1.0 : isHovered ? 0.95 : 0.88;

      this.bgGfx
        .roundRect(rect.x, rect.y, rect.w, rect.h, 6)
        .fill({ color: fillColor, alpha: fillAlpha })
        .stroke({
          color: isSelected ? 0x4f46e5 : borderColor,
          width: isSelected ? strokeW * 2 : strokeW,
          alpha: isSelected ? 1.0 : 0.7,
        });

      // Compact hit region registered to the shared hit layer.
      this.hitLayer
        .rect(rect.x, rect.y, rect.w, rect.h)
        .fill({ color: 0x000000, alpha: 0.001 });
      this.hitByPoint.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h, id: file.id });
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
