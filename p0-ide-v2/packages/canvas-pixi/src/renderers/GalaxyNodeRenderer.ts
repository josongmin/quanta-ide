import { Container, Graphics, FederatedPointerEvent } from "pixi.js";
import type { FileNode, WorkspaceLayout, ViewState, Viewport } from "@quanta/canvas-engine";
import { InstancedRectMesh, FLOATS_PER_INSTANCE, unpackHexInto } from "./shared/InstancedRectMesh";
import { SpatialPickIndex, type PickRect } from "./shared/SpatialPickIndex";

// Galaxy LOD (scale < 0.15): the whole codebase from far away. Each file card
// is tens of CSS pixels — text would be unreadable. This renderer is stripped
// to rectangles-only and draws them via an instanced Mesh: 5000 files → 1
// draw call, no per-file Graphics allocation, no vertex-buffer churn.
//
// Hit testing: the hitLayer Graphics covers every card with a near-zero-alpha
// fill so Pixi's event system can detect pointerover the whole node region,
// but the actual per-rect lookup is done via SpatialPickIndex (RBush).
// Linear scanning 5000 rects on every pointermove was the former bottleneck.

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
  private rectMesh: InstancedRectMesh;
  private hitLayer: Graphics;
  private pickIndex: SpatialPickIndex;
  private pickRects: PickRect[] = [];

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
    this.rectMesh = new InstancedRectMesh(1024);
    this.hitLayer = new Graphics();
    this.pickIndex = new SpatialPickIndex();
    this.onClickFile = opts?.onClick;
    this.onHoverFile = opts?.onHover;

    this.container.addChild(this.rectMesh.mesh);

    // Mesh does not emit pointer events (no per-instance hit testing in
    // WebGL without a readback). Use an overlaid invisible Graphics that
    // covers each rect — still one eventMode:static object for all files.
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
    const local = this.container.toLocal({ x: globalX, y: globalY });
    return this.pickIndex.pickAt(local.x, local.y);
  }

  update(files: FileNode[], layout: WorkspaceLayout, viewState: ViewState, viewport: Viewport): void {
    const invScale = Math.min(8, Math.max(0.5, 1 / viewport.scale));
    const strokeW = invScale;

    // Pre-count to size the buffer once.
    let count = 0;
    for (const file of files) {
      if (layout.fileRects.has(file.id)) count++;
    }
    this.rectMesh.ensureCapacity(count);

    const data = this.rectMesh.view();
    this.pickRects.length = 0;
    // Compute the layout AABB so we can size the single hit rect to cover
    // just the populated region. A bounding box is O(n) to compute but O(1)
    // ever after for Pixi's event system — far cheaper than N per-rect
    // Graphics calls and the geometry rebuild they trigger.
    let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;

    let i = 0;
    for (const file of files) {
      const rect = layout.fileRects.get(file.id);
      if (!rect) continue;

      const isSelected = viewState.selectedFileId === file.id;
      const isHovered = viewState.hoveredFileId === file.id;

      const fillColor = riskFill(file.riskScore);
      const borderColor = isSelected ? 0x4f46e5 : riskBorder(file.riskScore);
      const fillAlpha = isSelected ? 1.0 : isHovered ? 0.95 : 0.88;
      const borderAlpha = isSelected ? 1.0 : 0.7;
      const bw = isSelected ? strokeW * 2 : strokeW;

      const o = i * FLOATS_PER_INSTANCE;
      data[o] = rect.x;
      data[o + 1] = rect.y;
      data[o + 2] = rect.w;
      data[o + 3] = rect.h;
      unpackHexInto(fillColor, data, o + 4, fillAlpha);
      unpackHexInto(borderColor, data, o + 8, borderAlpha);
      data[o + 12] = bw;
      data[o + 13] = 6; // corner radius

      this.pickRects.push({ x: rect.x, y: rect.y, w: rect.w, h: rect.h, id: file.id });
      if (rect.x < minX) minX = rect.x;
      if (rect.y < minY) minY = rect.y;
      if (rect.x + rect.w > maxX) maxX = rect.x + rect.w;
      if (rect.y + rect.h > maxY) maxY = rect.y + rect.h;

      i++;
    }

    // Single invisible hit rect over the populated AABB. Pixi delivers
    // pointermove anywhere in this box; SpatialPickIndex resolves the id.
    // This replaces N per-file rect() calls (one of the former galaxy-LOD
    // hot spots) with a single Graphics command.
    this.hitLayer.clear();
    if (i > 0) {
      const w = maxX - minX;
      const h = maxY - minY;
      this.hitLayer.rect(minX, minY, w, h).fill({ color: 0x000000, alpha: 0.001 });
    }

    this.rectMesh.setInstanceCount(i);
    this.pickIndex.load(this.pickRects);
  }

  destroy(): void {
    this.rectMesh.destroy();
    this.pickIndex.clear();
    this.pickRects.length = 0;
    this.container.destroy({ children: true });
  }
}
