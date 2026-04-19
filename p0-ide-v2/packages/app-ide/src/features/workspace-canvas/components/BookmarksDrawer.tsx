import { useCallback, useMemo, useState } from "react";
import {
  bookmarksStore,
  useBookmarksStore,
  bookmarksForPage,
  type Bookmark,
  type BookmarkFilterState,
} from "../store/bookmarks-store";
import { usePagesStore } from "../store/pages-store";
import { useFeature } from "../store/feature-flags-store";
import { viewportStore } from "../store/viewport-store";
import { renderSettingsStore } from "../store/render-settings-store";
import { interactionStore } from "../store/interaction-store";
import { animateCameraTo } from "../lib/camera-animator";
import { storyboardStore, useStoryboardStore } from "../store/storyboard-store";

// BookmarksDrawer (Batch 5 — Navigation)
// -------------------------------------------------------------------
// Collapsible strip below the pages tab bar. Shows the bookmarks for
// the active page as a horizontal thumbnail grid. Clicking a thumbnail
// animates the camera + restores filter state; "Capture" saves a new
// bookmark from the current camera/filter.

interface CaptureOpts {
  label: string;
  thumbnail?: string;
}

function defaultLabel(n: number): string {
  return `View ${n + 1}`;
}

function captureThumbnail(): string | undefined {
  // Direct-child selector pins this to the Pixi stage canvas. A plain
  // descendant selector also matches HUD canvases (minimap heat, temporal
  // strip) and would pick whichever appears first in document order.
  if (typeof document === "undefined") return undefined;
  const canvas = document.querySelector(".workspace-canvas > canvas");
  if (!(canvas instanceof HTMLCanvasElement)) return undefined;
  try {
    const scaled = scaledThumbnail(canvas, 160, 96);
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
    // Fit the source while preserving aspect ratio.
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
  const existingCount = bookmarksForPage(bookmarksStore.getState(), pageId).length;
  return bookmarksStore.create({
    pageId,
    label: opts.label ?? defaultLabel(existingCount),
    cameraState: { x: vp.x, y: vp.y, scale: vp.scale },
    filterState: filter,
    thumbnail: opts.thumbnail ?? captureThumbnail(),
  });
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
}

export function BookmarksDrawer() {
  const pagesOn = useFeature("nav.pages");
  const bookmarksOn = useFeature("nav.bookmarks");
  const storyboardOn = useFeature("nav.storyboard");
  const activePageId = usePagesStore(s => s.activeId);
  const bookmarks = useBookmarksStore(s => s.bookmarks);
  const [open, setOpen] = useState(true);

  const forPage = useMemo(
    () => bookmarksForPage({ bookmarks }, activePageId),
    [bookmarks, activePageId],
  );

  const onCapture = useCallback(() => {
    captureCurrentBookmark(activePageId);
  }, [activePageId]);

  const onPlay = useCallback(() => {
    if (forPage.length === 0) return;
    storyboardStore.start(activePageId, 0);
  }, [activePageId, forPage.length]);

  if (!bookmarksOn) return null;
  // If pages off, still render for a single implicit page.

  return (
    <div className={`ws-bookmarks${open ? " ws-bookmarks--open" : " ws-bookmarks--collapsed"}`}>
      <div className="ws-bookmarks__header">
        <button
          type="button"
          className="ws-bookmarks__toggle"
          onClick={() => setOpen(v => !v)}
          aria-expanded={open}
          title={open ? "Collapse bookmarks" : "Expand bookmarks"}
        >
          {open ? "▾" : "▸"} Views ({forPage.length})
        </button>
        <div className="ws-bookmarks__actions">
          <button
            type="button"
            className="ws-bookmarks__btn"
            onClick={onCapture}
            title="Capture current camera + filters as a named view"
          >
            Capture
          </button>
          {storyboardOn && forPage.length > 0 && (
            <button
              type="button"
              className="ws-bookmarks__btn"
              onClick={onPlay}
              title="Play the tour"
            >
              Play tour
            </button>
          )}
        </div>
      </div>
      {open && (
        <div className="ws-bookmarks__grid">
          {forPage.length === 0 ? (
            <div className="ws-bookmarks__empty" role="status">
              <span className="ws-bookmarks__empty-icon" aria-hidden="true">◎</span>
              <div className="ws-bookmarks__empty-body">
                <span className="ws-bookmarks__empty-title">No views saved yet</span>
                <span className="ws-bookmarks__empty-hint">
                  Click <kbd>Capture</kbd> to pin the current camera + filters
                  {pagesOn ? " to this page" : ""}.
                </span>
              </div>
            </div>
          ) : (
            forPage.map(bm => (
              <BookmarkThumb
                key={bm.id}
                bookmark={bm}
                onApply={() => applyBookmarkToCanvas(bm.id)}
              />
            ))
          )}
        </div>
      )}
    </div>
  );
}

function BookmarkThumb({
  bookmark,
  onApply,
}: {
  bookmark: Bookmark;
  onApply: () => void;
}) {
  const playing = useStoryboardStore(s => s.playing);
  const stepIndex = useStoryboardStore(s => s.stepIndex);
  const pageId = useStoryboardStore(s => s.pageId);
  const isActive = playing && pageId === bookmark.pageId && stepIndex >= 0;

  return (
    <div className="ws-bookmarks__thumb-wrap">
      <button
        type="button"
        className={`ws-bookmarks__thumb${isActive ? " ws-bookmarks__thumb--playing" : ""}`}
        onClick={onApply}
        title={`${bookmark.label} — click to restore`}
      >
        {bookmark.thumbnail ? (
          <img
            src={bookmark.thumbnail}
            alt={bookmark.label}
            className="ws-bookmarks__thumb-img"
            draggable={false}
          />
        ) : (
          <div className="ws-bookmarks__thumb-placeholder">
            <span>
              {bookmark.cameraState.scale.toFixed(2)}×
            </span>
          </div>
        )}
        <span className="ws-bookmarks__thumb-label">{bookmark.label}</span>
      </button>
      <button
        type="button"
        className="ws-bookmarks__thumb-x"
        onClick={e => {
          e.stopPropagation();
          bookmarksStore.remove(bookmark.id);
        }}
        title="Delete view"
        aria-label="Delete view"
      >
        ×
      </button>
    </div>
  );
}
