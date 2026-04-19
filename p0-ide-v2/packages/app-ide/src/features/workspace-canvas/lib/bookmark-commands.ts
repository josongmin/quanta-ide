// Bookmark domain commands — pure store-driven operations.
// -------------------------------------------------------------------
// These functions were historically hosted in
// `components/BookmarksDrawer.tsx`, which caused a lib→component
// dependency inversion (command-registry / MultiFileCanvas / storyboard
// all had to import a component module just to invoke bookmark logic).
//
// The operations here do NOT render anything. They only:
//   * read/write workspace-canvas stores (bookmarks, viewport, render,
//     interaction, scene),
//   * dispatch lightweight window events the drawer listens for
//     (capture/applied/capture-request).
//
// The drawer keeps the UI state (expansion, rename focus, preview card)
// and the DOM-adjacent helpers (thumbnail canvas capture).

import {
  bookmarksStore,
  type BookmarkFilterState,
} from "../store/bookmarks-store";
import { viewportStore } from "../store/viewport-store";
import { renderSettingsStore } from "../store/render-settings-store";
import { interactionStore } from "../store/interaction-store";
import { sceneStore } from "../store/scene-store";
import { animateCameraTo } from "./camera-animator";

// Window-event names the drawer subscribes to. Kept here so both sides
// refer to the same canonical strings.
export const BOOKMARK_CAPTURED_EVENT = "workspace-bookmarks:captured";
export const BOOKMARK_APPLIED_EVENT = "workspace-bookmarks:applied";
export const BOOKMARK_CAPTURE_REQUEST_EVENT = "workspace-bookmarks:capture-request";

export interface CapturedDetail { id: string; pageId: string }

export interface CaptureOpts {
  label: string;
  thumbnail?: string;
}

function basename(path: string): string {
  const trimmed = path.split(/[?#]/)[0] ?? path;
  const i = trimmed.lastIndexOf("/");
  const tail = i >= 0 ? trimmed.slice(i + 1) : trimmed;
  return tail || trimmed;
}

// Pick a meaningful label at capture time — in order of signal strength:
//   1. Explicitly selected file → its basename.
//   2. Whichever file rect's center is closest to the viewport center.
//   3. Fallback: the current zoom level, so at least it's distinguishable.
export function autoLabelBookmark(): string {
  const selected = interactionStore.getState().viewState.selectedFileId;
  const { graph, layout } = sceneStore.getState();
  if (selected && graph) {
    const f = graph.files.find(ff => ff.id === selected);
    if (f) return basename(f.name || f.id);
  }
  const vp = viewportStore.getState().viewport;
  if (graph && layout && vp.width > 0 && vp.height > 0 && vp.scale > 0) {
    const cx = (vp.width / 2 - vp.x) / vp.scale;
    const cy = (vp.height / 2 - vp.y) / vp.scale;
    let bestId: string | null = null;
    let bestD = Infinity;
    layout.fileRects.forEach((rect, id) => {
      const rx = rect.x + rect.w / 2;
      const ry = rect.y + rect.h / 2;
      const dx = cx - rx;
      const dy = cy - ry;
      const d = dx * dx + dy * dy;
      if (d < bestD) { bestD = d; bestId = id; }
    });
    if (bestId) {
      const f = graph.files.find(ff => ff.id === bestId);
      if (f) return basename(f.name || f.id);
    }
  }
  return `Zoom ${vp.scale.toFixed(2)}×`;
}

// WHY: kept here rather than on BookmarksDrawer because thumbnail capture
// pokes at the Pixi <canvas> directly — a DOM op but not a React render.
// Any caller outside the drawer (palette, MultiFileCanvas keybinds) gets
// a consistent thumbnail regardless of drawer mount state.
export function captureThumbnail(): string | undefined {
  if (typeof document === "undefined") return undefined;
  const canvas = document.querySelector(".workspace-canvas canvas");
  if (!(canvas instanceof HTMLCanvasElement)) return undefined;
  try {
    const scaled = scaledThumbnail(canvas, 240, 144);
    return scaled ?? canvas.toDataURL("image/png");
  } catch {
    return undefined;
  }
}

function scaledThumbnail(src: HTMLCanvasElement, w: number, h: number): string | undefined {
  try {
    const off = document.createElement("canvas");
    off.width = w;
    off.height = h;
    const ctx = off.getContext("2d");
    if (!ctx) return undefined;
    ctx.fillStyle = "#0f172a";
    ctx.fillRect(0, 0, w, h);
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
    return undefined;
  }
}

export function captureCurrentBookmark(pageId: string, opts: Partial<CaptureOpts> = {}): string {
  const vp = viewportStore.getState().viewport;
  const filter: BookmarkFilterState = {
    edgeFilterQuery: renderSettingsStore.getState().edgeFilterQuery || undefined,
    focusFileId: interactionStore.getState().viewState.selectedFileId,
  };
  const id = bookmarksStore.create({
    pageId,
    label: opts.label ?? autoLabelBookmark(),
    cameraState: { x: vp.x, y: vp.y, scale: vp.scale },
    filterState: filter,
    thumbnail: opts.thumbnail ?? captureThumbnail(),
  });
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<CapturedDetail>(BOOKMARK_CAPTURED_EVENT, {
      detail: { id, pageId },
    }));
  }
  return id;
}

export function applyBookmarkToCanvas(bookmarkId: string): void {
  const bm = bookmarksStore.getState().bookmarks.find(b => b.id === bookmarkId);
  if (!bm) return;
  animateCameraTo(bm.cameraState);
  if (bm.filterState) {
    if (typeof bm.filterState.edgeFilterQuery === "string") {
      renderSettingsStore.setEdgeFilterQuery(bm.filterState.edgeFilterQuery);
    }
    if (bm.filterState.focusFileId !== undefined) {
      interactionStore.selectFile(bm.filterState.focusFileId);
    }
  }
  if (typeof window !== "undefined") {
    window.dispatchEvent(new CustomEvent<{ id: string }>(BOOKMARK_APPLIED_EVENT, {
      detail: { id: bookmarkId },
    }));
  }
}

// Keybinds (MultiFileCanvas) dispatch this; the drawer fulfils it so the
// post-capture rename-focus dance lives in one place.
export function requestCaptureCurrentBookmark(): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent(BOOKMARK_CAPTURE_REQUEST_EVENT));
}
