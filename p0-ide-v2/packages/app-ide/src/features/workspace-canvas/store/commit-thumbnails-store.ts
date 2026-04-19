import { useSyncExternalStore } from "react";

// Commit thumbnails store (read-only shell)
// -------------------------------------------------------------------
// Historically this store held canvas-captured preview images keyed by
// commit short-sha for the film-strip scrubber. The capture pipeline
// (`capture-commit-thumbnail.ts`) has been removed, so nothing writes
// to this store at runtime — it now exists as a stable read surface
// for `FilmStripScrubber` so we don't need to patch the component.
//
// When a real thumbnail source lands (server-rendered PNGs, pixi
// `renderer.extract`, etc.) a new write path can be added back; the
// read API below is what callers depend on.

export interface CommitThumbnail {
  sha: string;
  /** data-URI or blob URL; undefined while still capturing. */
  dataUrl?: string;
  /** Epoch ms the thumb was captured — used to invalidate stale previews. */
  capturedAt?: number;
  /** Viewport fingerprint so callers can tell if the preview matches their
   *  current camera. Opaque string; compared via equality only. */
  fingerprint?: string;
}

export interface CommitThumbnailsState {
  /** shortSha → thumbnail. Iterates LRU-ordered (oldest first). */
  readonly byShortSha: ReadonlyMap<string, CommitThumbnail>;
  /** Total persisted byte count — kept in sync on every mutation. */
  readonly totalBytes: number;
}

const state: CommitThumbnailsState = {
  byShortSha: new Map(),
  totalBytes: 0,
};

function getState(): CommitThumbnailsState { return state; }

function subscribe(_listener: () => void): () => void {
  // No writers = no events. Return a no-op unsubscribe so callers using
  // `useSyncExternalStore` still get a stable reference.
  return () => {};
}

function getThumbnail(_shortSha: string): CommitThumbnail | undefined {
  return undefined;
}

export const commitThumbnailsStore = {
  getState,
  subscribe,
  getThumbnail,
};

export function useCommitThumbnail(shortSha: string | undefined): CommitThumbnail | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (shortSha ? state.byShortSha.get(shortSha) : undefined),
    () => (shortSha ? state.byShortSha.get(shortSha) : undefined),
  );
}
