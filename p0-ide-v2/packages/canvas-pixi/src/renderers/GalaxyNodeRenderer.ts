import { Graphics, Container, Text } from "pixi.js";
import type { FileNode, WorkspaceLayout, ViewState } from "@quanta/canvas-engine";

function riskFill(score: number): number {
  if (score >= 70) return 0xfee2e2; // red tint
  if (score >= 40) return 0xfef3c7; // yellow tint
  return 0xdcfce7;                  // green tint
}

function riskBorder(score: number): number {
  if (score >= 70) return 0xfca5a5;
  if (score >= 40) return 0xfcd34d;
  return 0x86efac;
}

function riskText(score: number): number {
  if (score >= 70) return 0xdc2626;
  if (score >= 40) return 0xd97706;
  return 0x16a34a;
}

export class GalaxyNodeRenderer {
  private container: Container;
  private bgGfx: Graphics;
  private labelContainer: Container;
  private hitAreas: Graphics[] = [];

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
    this.labelContainer = new Container();
    this.onClickFile = opts?.onClick;
    this.onHoverFile = opts?.onHover;

    // Order: bg → labels → hit areas
    this.container.addChild(this.bgGfx);
    this.container.addChild(this.labelContainer);
    parent.addChild(this.container);
  }

  update(files: FileNode[], layout: WorkspaceLayout, viewState: ViewState): void {
    const invScale = Math.min(8, Math.max(0.5, 1 / viewState.viewport.scale));

    this.bgGfx.clear();
    this.labelContainer.removeChildren();
    for (const h of this.hitAreas) {
      h.destroy();
    }
    this.hitAreas = [];

    for (const file of files) {
      const rect = layout.fileRects.get(file.id);
      if (!rect) continue;

      const isSelected = viewState.selectedFileId === file.id;
      const isHovered = viewState.hoveredFileId === file.id;

      const fillColor = riskFill(file.riskScore);
      const borderColor = riskBorder(file.riskScore);
      const strokeW = invScale; // scale-independent: always ≥1 screen pixel
      const fillAlpha = isSelected ? 1.0 : isHovered ? 0.95 : 0.88;

      // Background fill
      this.bgGfx
        .roundRect(rect.x, rect.y, rect.w, rect.h, 6)
        .fill({ color: fillColor, alpha: fillAlpha });

      // Border stroke
      this.bgGfx
        .roundRect(rect.x, rect.y, rect.w, rect.h, 6)
        .stroke({
          color: isSelected ? 0x4f46e5 : borderColor,
          width: isSelected ? strokeW * 2 : strokeW,
          alpha: isSelected ? 1.0 : 0.85,
        });

      // Header bar (rounded top)
      this.bgGfx
        .roundRect(rect.x, rect.y, rect.w, 28 * invScale, 6)
        .fill({ color: borderColor, alpha: 0.75 });

      // Fill the lower portion of header to square off bottom of header bar
      this.bgGfx
        .rect(rect.x, rect.y + 12 * invScale, rect.w, 16 * invScale)
        .fill({ color: borderColor, alpha: 0.55 });

      // File name label
      const nameLabel = new Text({
        text: file.name.length > 20 ? "…" + file.name.slice(-18) : file.name,
        style: {
          fontSize: 11,
          fill: 0x1a1a2e,
          fontFamily: "system-ui, sans-serif",
          fontWeight: "500",
        },
      });
      nameLabel.scale.set(invScale);
      nameLabel.x = rect.x + 8 * invScale;
      nameLabel.y = rect.y + 7 * invScale;
      this.labelContainer.addChild(nameLabel);

      // Risk score badge
      const scoreLabel = new Text({
        text: String(file.riskScore),
        style: {
          fontSize: 10,
          fill: riskText(file.riskScore),
          fontFamily: "system-ui",
          fontWeight: "700",
        },
      });
      scoreLabel.scale.set(invScale);
      scoreLabel.x = rect.x + rect.w - scoreLabel.width - 8 * invScale;
      scoreLabel.y = rect.y + 8 * invScale;
      this.labelContainer.addChild(scoreLabel);

      // LOC label
      const locLabel = new Text({
        text: `${file.loc.toLocaleString()} lines`,
        style: { fontSize: 9, fill: 0x888888, fontFamily: "system-ui" },
      });
      locLabel.scale.set(invScale);
      locLabel.x = rect.x + 8 * invScale;
      locLabel.y = rect.y + rect.h - 18 * invScale;
      this.labelContainer.addChild(locLabel);

      // Signal badges (taint)
      if (file.signals.taintCount > 0) {
        const taintLabel = new Text({
          text: `⚡ ${file.signals.taintCount}`,
          style: { fontSize: 9, fill: 0xdc2626, fontFamily: "system-ui" },
        });
        taintLabel.scale.set(invScale);
        taintLabel.x = rect.x + 8 * invScale;
        taintLabel.y = rect.y + 34 * invScale;
        this.labelContainer.addChild(taintLabel);
      }

      // Transparent hit area for pointer events
      const hit = new Graphics();
      hit.rect(rect.x, rect.y, rect.w, rect.h).fill({ color: 0x000000, alpha: 0.001 });
      hit.eventMode = "static";
      hit.cursor = "pointer";
      const fileId = file.id;
      hit.on("pointertap", () => this.onClickFile?.(fileId));
      hit.on("pointerover", () => this.onHoverFile?.(fileId));
      hit.on("pointerout", () => this.onHoverFile?.(null));
      this.container.addChild(hit);
      this.hitAreas.push(hit);
    }
  }

  destroy(): void {
    this.container.destroy({ children: true });
  }
}
