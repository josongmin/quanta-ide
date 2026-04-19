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
// Implementation — prebuilt MSDF atlas via `Assets.load()`:
//   Runtime loads two pre-generated .fnt files (Pretendard Regular + Bold)
//   and their multi-page MSDF PNGs. Atlas generation happens at build time
//   (see `scripts/build-msdf-font.mjs`) so the main thread never rasterizes
//   glyphs or runs MSDF kerning passes.
//
//   An earlier iteration of this file called `BitmapFont.install(...)` with
//   a runtime `distanceField` option and a [[" ", "~"], ["가", "힣"]] char
//   range. Pixi 8 resolves that to a synchronous per-glyph canvas render +
//   readPixels + kerning pair loop (~11k glyphs → ~O(n²) kerning), which
//   froze the Code Universe tab for 90–140 s on first open. Plan A (atlas
//   at build time) removes the synchronous install entirely.
//
// Runtime contract:
//   `ensureMsdfFont()` — idempotent; resolves when both MSDF atlases are
//     registered in Pixi's Assets cache, or when the load failed and the
//     raster fallback has taken over. Safe to call before or after Pixi
//     app init; the underlying BitmapFont parser needs a Renderer ready
//     (guaranteed because PixiStage awaits this only inside `coldInit`
//     after `await app.init()`).
//   `msdfText(text, size, tint, rasterFamily)` — always returns a usable
//     BitmapText. Uses MSDF when ready; raster fallback otherwise. Bold
//     intent is signaled by passing `CITY_FONT_BOLD_NAME` as rasterFamily
//     (the canonical mapping used by supercluster / cluster label renderers).

import { Assets, BitmapText } from "pixi.js";
import { CITY_FONT_NAME, CITY_FONT_BOLD_NAME, installCityFonts } from "./BitmapFontAtlas";

// The `face` attribute baked into the generated .fnt by `msdf-bmfont-xml`
// always mirrors the source OTF's internal name. Pixi registers the
// BitmapFont under that face; `BitmapText({ style: { fontFamily: <face> } })`
// then picks it up.
const MSDF_REGULAR_FACE = "Pretendard-Regular";
const MSDF_BOLD_FACE = "Pretendard-Bold";

// Atlas URLs resolve against Vite's BASE_URL so web (`/ide/`) and Tauri
// (`/`) builds both serve from `public/fonts/` correctly.
function atlasUrl(fntFilename: string): string {
  const base = import.meta.env?.BASE_URL ?? "/";
  return `${base}fonts/${fntFilename}`;
}

type FontMode = "pending" | "msdf" | "raster";
let mode: FontMode = "pending";
let loadPromise: Promise<void> | null = null;
let warnedFallback = false;

async function loadMsdfOnce(): Promise<void> {
  try {
    // Parallel fetch. Pixi's BitmapFont parser handles multi-page atlases
    // transparently (each .fnt's `<pages>` declares its PNG pages, which
    // resolve relative to the .fnt URL).
    await Promise.all([
      Assets.load(atlasUrl("Pretendard-Regular.fnt")),
      Assets.load(atlasUrl("Pretendard-Bold.fnt")),
    ]);
    mode = "msdf";
  } catch (err) {
    // Any load error (404, parse error, offline) means we stay on the raster
    // atlas — which must exist before `msdfText()` starts handing out
    // BitmapText instances.
    try { installCityFonts(); } catch { /* installCityFonts is idempotent */ }
    mode = "raster";
    if (!warnedFallback) {
      warnedFallback = true;
      console.warn("[msdf-text] MSDF atlas load failed, falling back to raster BitmapText", err);
    }
  }
}

/**
 * Kick off (or await the in-flight) MSDF atlas load. Single-flight by
 * module-level promise caching — concurrent callers share one `Assets.load`.
 */
export function ensureMsdfFont(): Promise<void> {
  if (mode !== "pending") return Promise.resolve();
  loadPromise ??= loadMsdfOnce();
  return loadPromise;
}

/**
 * Construct a BitmapText. Uses MSDF when its atlas is registered, otherwise
 * the shared raster atlas (CITY_FONT_NAME by default). Never throws — if
 * neither font is available (ensureMsdfFont() was not awaited yet), the
 * returned BitmapText still compiles but may render empty glyphs until the
 * font registers.
 *
 * @param rasterFamily — fallback font-family name used when MSDF is
 *   unavailable. Defaults to CITY_FONT_NAME. Passing CITY_FONT_BOLD_NAME
 *   signals bold intent — the MSDF path honors it by routing to the bold
 *   atlas. All other rasterFamily values (including CITY_MONO_FONT_NAME)
 *   collapse to the regular MSDF atlas; mono variants at runtime would
 *   require a third MSDF atlas we do not ship.
 */
export function msdfText(text: string, size: number, tint?: number, rasterFamily?: string): BitmapText {
  const wantBold = rasterFamily === CITY_FONT_BOLD_NAME;
  const fontFamily = mode === "msdf"
    ? (wantBold ? MSDF_BOLD_FACE : MSDF_REGULAR_FACE)
    : (rasterFamily ?? CITY_FONT_NAME);
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
  loadPromise = null;
  warnedFallback = false;
}
