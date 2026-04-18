// Shared bitmap fonts for city-LOD labels.
//
// Why BitmapText instead of Text: Text rasterizes a fresh GPU texture on every
// style or string change. For 5000 files × ~3 labels, that's 15k texture
// uploads per redraw — bandwidth-bound and GC-heavy. BitmapText shares a
// single GPU atlas and emits quad instances from the existing batch pipeline,
// so 15k labels still pack into a few draw calls.
//
// Install pattern: triggered once at module load (side-effect import). Keeps
// renderer constructors cheap and avoids the hot-path guard check. An
// idempotent flag remains as a safety net for double-import across bundles.

import { BitmapFont } from "pixi.js";

export const CITY_FONT_NAME = "quanta-city";
export const CITY_FONT_BOLD_NAME = "quanta-city-bold";
export const CITY_MONO_FONT_NAME = "quanta-city-mono";

let installed = false;

export function installCityFonts(): void {
  if (installed) return;
  installed = true;

  // Tint is applied per-BitmapText via style.fill, so we install the font
  // once in white and colorize at draw time. fontSize here is the bitmap
  // resolution — 28px gives room to scale down to ~9px screen without
  // perceptible loss, and still reuse the same atlas when zoomed in.
  BitmapFont.install({
    name: CITY_FONT_NAME,
    style: {
      fontFamily: "system-ui, sans-serif",
      fontSize: 28,
      fill: 0xffffff,
    },
  });

  BitmapFont.install({
    name: CITY_FONT_BOLD_NAME,
    style: {
      fontFamily: "system-ui, sans-serif",
      fontSize: 28,
      fontWeight: "700",
      fill: 0xffffff,
    },
  });

  BitmapFont.install({
    name: CITY_MONO_FONT_NAME,
    style: {
      fontFamily: "JetBrains Mono, monospace",
      fontSize: 28,
      fill: 0xffffff,
    },
  });
}

// NOTE: We intentionally do NOT call installCityFonts() at module load —
// Pixi's BitmapFont.install needs the default Renderer ready, which isn't
// the case before any Application.init(). We also cannot depend on the
// import order getting that right. Callers (renderers) invoke this lazily
// in their constructor; the `installed` guard makes repeat calls free.
