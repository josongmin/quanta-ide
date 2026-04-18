import { Graphics, Container } from "pixi.js";
import { mixHex } from "@quanta/canvas-engine";
import {
  DEFAULT_ISO_CONFIG,
  buildIsoBoxFaces,
  type IsoConfig,
} from "./iso-projection";
import { CROSS_GRAPH_ACCENT } from "../shared/colors";

export interface IsoTerrainBar {
  fileId: string;
  rect: { x: number; y: number; w: number; h: number };
  /** 0..1 — normalized score; renderer scales to cfg.maxZ. */
  heightNorm: number;
  /** Top-face color (hex). Front/right are darkened derivatives. */
  colorHex: number;
  /** 0..1 — dim factor applied globally on top of per-face shading. */
  alpha?: number;
  /** When true, strokes an accent outline around the top polygon. */
  highlighted?: boolean;
}

const MIN_VISIBLE_HEIGHT_NORM = 0.01;

const HIGHLIGHT_STROKE_COLOR = CROSS_GRAPH_ACCENT;
const HIGHLIGHT_STROKE_WIDTH = 2;

const FRONT_DARKEN_T = 0.3;
const RIGHT_DARKEN_T = 0.15;

export class IsoTerrainRenderer {
  private gfx: Graphics;

  constructor(world: Container) {
    this.gfx = new Graphics();
    world.addChild(this.gfx);
  }

  build(bars: readonly IsoTerrainBar[], cfg: IsoConfig = DEFAULT_ISO_CONFIG): void {
    this.gfx.clear();
    if (bars.length === 0) return;

    // Paint south-to-north so southern (lower-Y-base) bars occlude the
    // columns behind them — faking proper z-order without a full 3D pipeline.
    const sorted = [...bars].sort((a, b) => a.rect.y - b.rect.y);

    for (const bar of sorted) {
      // Defensive clamp — upstream is expected to sanitize, but NaN
      // leakage here produces NaN polygon coords and garbage frames.
      const h = Number.isFinite(bar.heightNorm) ? bar.heightNorm : 0;
      if (h <= MIN_VISIBLE_HEIGHT_NORM) continue;

      const zHeight = cfg.maxZ * h;
      if (!Number.isFinite(zHeight) || zHeight <= 0) continue;
      const faces = buildIsoBoxFaces(bar.rect, zHeight, cfg);
      const globalAlpha = bar.alpha ?? 1;

      const topColor = bar.colorHex;
      const frontColor = mixHex(topColor, 0x000000, FRONT_DARKEN_T);
      const rightColor = mixHex(topColor, 0x000000, RIGHT_DARKEN_T);

      // Draw order matters: front first (painted under), right next,
      // top last so it reads as the lit surface on top of the extrusion.
      this.gfx
        .poly([...faces.front], true)
        .fill({ color: frontColor, alpha: globalAlpha });
      this.gfx
        .poly([...faces.right], true)
        .fill({ color: rightColor, alpha: globalAlpha });
      this.gfx
        .poly([...faces.top], true)
        .fill({ color: topColor, alpha: globalAlpha });

      if (bar.highlighted) {
        this.gfx
          .poly([...faces.top], true)
          .stroke({
            color: HIGHLIGHT_STROKE_COLOR,
            alpha: globalAlpha,
            width: HIGHLIGHT_STROKE_WIDTH,
          });
      }
    }
  }

  clear(): void {
    this.gfx.clear();
  }

  destroy(): void {
    this.gfx.destroy();
  }
}
