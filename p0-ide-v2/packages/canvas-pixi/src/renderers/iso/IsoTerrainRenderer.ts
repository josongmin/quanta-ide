import { Graphics, Container } from "pixi.js";
import { mixHex } from "@quanta/canvas-engine";
import {
  DEFAULT_ISO_CONFIG,
  buildIsoBoxFaces,
  type IsoConfig,
} from "./iso-projection";

// Iso "action terrain" bars — one extruded cabinet-projected box per
// file card, encoding refactor-ROI (or similar) score as z-height.
// Drawn into a single shared Graphics so the full field can paint in
// one submit regardless of bar count.

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

/** Shorter than this is invisible at any reasonable zoom, so skip
 *  to save draw calls. */
const MIN_VISIBLE_HEIGHT_NORM = 0.01;

/** Amber accent for `highlighted` bars — matches the HUD warning token. */
const HIGHLIGHT_STROKE_COLOR = 0xfacc15;
const HIGHLIGHT_STROKE_WIDTH = 2;

/** Face shading multipliers — darken against a neutral black via mixHex. */
const FRONT_DARKEN_T = 0.3; // front face lerps 30% toward black → 70% brightness
const RIGHT_DARKEN_T = 0.15; // right face lerps 15% toward black → 85% brightness

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
      if (bar.heightNorm <= MIN_VISIBLE_HEIGHT_NORM) continue;

      const zHeight = cfg.maxZ * bar.heightNorm;
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
