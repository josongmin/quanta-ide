// capture-commit-thumbnail — render the current canvas state into a
// tiny PNG data-URL for the film-strip preview and store it under the
// current commit SHA.
//
// This intentionally lives separately from `commit-thumbnails-store`
// because it depends on DOM + Pixi internals (the store is pure data).
// The caller (film-strip hover / scrub) is responsible for first
// time-travelling the canvas to the target sha and awaiting a render
// tick; this helper grabs the result, scales, and caches.
//
// The implementation reuses the "first <canvas> under .workspace-canvas"
// trick from BookmarksDrawer so we don't need to reach into the Pixi
// Application directly (avoids a cross-package leak and survives
// renderer lifetime flaps). If we later move to `pixi.renderer.extract`,
// the call site changes but the public signature here does not.

import {
  commitThumbnailsStore,
  type CommitThumbnail,
} from "../store/commit-thumbnails-store";

export interface CaptureOptions {
  /** Target width for the cached thumbnail. Default 160. */
  width?: number;
  /** Target height. Default 96. */
  height?: number;
  /** Optional short sha — defaults to first 7 chars of `sha`. */
  shortSha?: string;
  /** Optional fingerprint string (caller-opaque). */
  fingerprint?: string;
  /** Override canvas selector (tests). Default `.workspace-canvas canvas`. */
  selector?: string;
}

export interface CaptureResult {
  sha: string;
  shortSha: string;
  dataUrl: string;
  /** True when the bytes were accepted by the LRU cache. */
  cached: boolean;
}

/**
 * Capture a thumbnail for the current canvas frame and associate it
 * with `sha`. Returns the data URL + cache status, or null if we
 * couldn't locate a canvas / render the preview.
 *
 * Preconditions:
 *   * `document` is available (browser; no-op under jsdom that lacks
 *     canvas — `getContext("2d")` returns null and we bail).
 *   * The caller has already time-travelled to `sha`; we do NOT
 *     coordinate with the history store to avoid coupling layers.
 */
export async function captureCommitThumbnail(
  sha: string,
  opts: CaptureOptions = {},
): Promise<CaptureResult | null> {
  if (!sha) return null;
  if (typeof document === "undefined") return null;

  const selector = opts.selector ?? ".workspace-canvas canvas";
  const source = document.querySelector(selector);
  if (!(source instanceof HTMLCanvasElement)) return null;

  const width = opts.width ?? 160;
  const height = opts.height ?? 96;

  // Give Pixi one render tick to settle before we grab the bitmap.
  // `requestAnimationFrame` is the closest thing we have to "after the
  // next frame" that doesn't reach into the Pixi application.
  await nextFrame();

  const dataUrl = scaledThumbnail(source, width, height);
  if (!dataUrl) return null;

  const shortSha = opts.shortSha ?? sha.slice(0, 7);
  const thumb: CommitThumbnail = {
    sha,
    dataUrl,
    capturedAt: Date.now(),
    fingerprint: opts.fingerprint,
  };
  const cached = commitThumbnailsStore.set(shortSha, thumb);
  return { sha, shortSha, dataUrl, cached };
}

/**
 * Same as `captureCommitThumbnail` but short-circuits when the cache
 * already has an entry for this sha. Callers on a scrub hotpath should
 * prefer this to avoid redundant draws.
 */
export async function captureAt(
  sha: string,
  opts: CaptureOptions = {},
): Promise<CaptureResult | null> {
  const shortSha = opts.shortSha ?? sha.slice(0, 7);
  const existing = commitThumbnailsStore.getThumbnail(shortSha);
  if (existing && existing.dataUrl && existing.sha === sha) {
    return { sha, shortSha, dataUrl: existing.dataUrl, cached: true };
  }
  return captureCommitThumbnail(sha, opts);
}

// ── Internals ──────────────────────────────────────────────────────

function scaledThumbnail(
  src: HTMLCanvasElement,
  w: number,
  h: number,
): string | null {
  try {
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctx = off.getContext("2d");
    if (!ctx) return null;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);
    // Aspect-preserving fit.
    const sA = src.width / src.height;
    const dA = w / h;
    let dw = w;
    let dh = h;
    if (sA > dA) dh = Math.round(w / sA);
    else dw = Math.round(h * sA);
    const dx = Math.round((w - dw) / 2);
    const dy = Math.round((h - dh) / 2);
    ctx.drawImage(src, dx, dy, dw, dh);
    return off.toDataURL("image/png");
  } catch {
    return null;
  }
}

function nextFrame(): Promise<void> {
  if (typeof requestAnimationFrame === "undefined") {
    return Promise.resolve();
  }
  return new Promise(resolve => {
    requestAnimationFrame(() => resolve());
  });
}
