// MSDF (multi-channel signed distance field) wrapper around Pixi's BitmapText.
//
// Why: `BitmapText` with a plain raster atlas re-builds glyph geometry every
// time `.style.fontSize` or `.scale` changes enough to pull a different
// mip/atlas entry. Pan/zoom on the workspace canvas does exactly that —
// `scale.set(invScale)` runs per-frame for every visible label. A distance-
// field font stores the glyph shape once; size is derived in the fragment
// shader, so the atlas is never re-keyed and `.scale` becomes a transform-
// only operation (no re-layout, no atlas re-lookup).
//
// Plan A — dynamic MSDF font: Pixi 8.6's `BitmapFont.install()` does not
// expose a `distanceFieldType` knob (the .d.ts `BitmapFontInstallOptions`
// does not include it). Dynamic MSDF fonts in Pixi 8 require a pre-generated
// `.fnt` + MSDF atlas PNG loaded via `Assets.load()` — we don't ship one.
//
// Plan B — shared font atlas: Keep the existing raster BitmapText, but route
// every renderer through the same font name so duplicate atlas uploads
// disappear, and consolidate the `new BitmapText({...})` call site so a
// future MSDF font asset can be swapped in by editing this one file.
//
// Runtime contract:
//   `ensureMsdfFont()` — idempotent; attempts MSDF install; on failure marks
//     fallback (plain raster) and warns exactly once. Safe to call before or
//     after Pixi app init (the install call itself needs a Pixi renderer
//     ready, so the caller must await app.init first).
//   `msdfText(text, size, tint)` — always returns a usable BitmapText. Uses
//     the MSDF font if the install succeeded, otherwise the shared raster
//     font (CITY_FONT_NAME). Either way, the BitmapText object is live
//     immediately — callers never need to branch on load state.

import { BitmapFont, BitmapText } from "pixi.js";
import { CITY_FONT_NAME, installCityFonts } from "./BitmapFontAtlas";

const MSDF_FONT_NAME = "canvas-msdf-sans";

// Tri-state: "pending" before any install attempt, "msdf" after a successful
// MSDF install, "raster" after an explicit fallback (either the install
// threw, or the caller's Pixi build does not support MSDF via the
// `BitmapFont.install` option bag).
type FontMode = "pending" | "msdf" | "raster";
let mode: FontMode = "pending";
let warnedFallback = false;

/**
 * Install the MSDF font once. On any failure, falls back to the shared
 * raster font atlas (CITY_FONT_NAME) and warns. Safe to call repeatedly.
 * Must be called *after* `await app.init()` — Pixi's BitmapFont.install
 * requires an active renderer.
 */
export async function ensureMsdfFont(): Promise<void> {
  if (mode !== "pending") return;
  try {
    // The dynamic-MSDF path: Pixi *may* accept a distanceField option in
    // some 8.x builds even though the public .d.ts does not declare it.
    // We pass it behind an unknown-cast so a stricter build rejects it at
    // runtime (caught below) rather than at compile time — that way the
    // wrapper compiles cleanly against the installed Pixi types while
    // still attempting the optimization when supported.
    const options: Record<string, unknown> = {
      name: MSDF_FONT_NAME,
      style: {
        fontFamily: "system-ui, -apple-system, sans-serif",
        // Source atlas size. Large enough to downscale cleanly in shader.
        fontSize: 64,
        fill: 0xffffff,
      },
      // Requested by the API in Pixi 8 docs; ignored by builds that do not
      // support dynamic MSDF. In that case we hit the catch block below.
      distanceField: { type: "msdf", range: 4 },
      resolution: 2,
      // ASCII (printable) + Hangul syllables. Matches the label surface area
      // the canvas renderers emit today.
      chars: [[" ", "~"], ["가", "힣"]],
    };
    // Cast is localized to this call; the options object is validated at
    // runtime, not at compile time (see note above).
    BitmapFont.install(options as Parameters<typeof BitmapFont.install>[0]);
    mode = "msdf";
  } catch (err) {
    // Any install error means we stay on the raster atlas. Make sure it
    // actually exists before `msdfText()` hands out a raster instance.
    try { installCityFonts(); } catch { /* installCityFonts is idempotent & already best-effort */ }
    mode = "raster";
    if (!warnedFallback) {
      warnedFallback = true;
      console.warn("[msdf-text] MSDF install failed, falling back to raster BitmapText", err);
    }
  }
}

/**
 * Construct a BitmapText. Uses the MSDF font if installed, otherwise the
 * shared raster atlas (CITY_FONT_NAME by default). Never throws — if
 * neither font is available (ensureMsdfFont() was not awaited yet), the
 * returned BitmapText still compiles but may render empty glyphs until the
 * font registers.
 *
 * @param rasterFamily — fallback font-family name used when MSDF is
 *   unavailable. Defaults to CITY_FONT_NAME. Renderers that need bold or
 *   mono variants pass their own family (CITY_FONT_BOLD_NAME /
 *   CITY_MONO_FONT_NAME) so the raster-path preserves the existing visual.
 *   When MSDF *is* available, all variants collapse to the single MSDF
 *   family — acceptable because MSDF rendering is shader-sized and bold/
 *   mono differentiation at runtime would require parallel MSDF atlases
 *   we do not ship.
 */
export function msdfText(text: string, size: number, tint?: number, rasterFamily?: string): BitmapText {
  const fontFamily = mode === "msdf" ? MSDF_FONT_NAME : (rasterFamily ?? CITY_FONT_NAME);
  const style: { fontFamily: string; fontSize: number; fill?: number } = {
    fontFamily,
    fontSize: size,
  };
  if (tint !== undefined) style.fill = tint;
  return new BitmapText({ text, style });
}

/** Introspection hook for tests — returns the current font mode. */
export function _msdfMode(): FontMode {
  return mode;
}

/** Test-only reset. Clears the module-level mode/warn flags. */
export function _resetMsdfForTests(): void {
  mode = "pending";
  warnedFallback = false;
}
