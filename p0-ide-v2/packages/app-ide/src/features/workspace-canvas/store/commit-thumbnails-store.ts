import { useSyncExternalStore } from "react";

// Commit thumbnails store
// -------------------------------------------------------------------
// Canvas-captured previews keyed by commit short-sha for the film-strip
// scrubber. An LRU cap keeps the total data-URL payload bounded —
// roughly 24 * 6KB = 144KB at the default thumb size.
//
// Writes are opt-in: FilmStripScrubber (or any other consumer) calls
// `captureCommitThumbnail(shortSha, dataUrl, fingerprint)` after
// extracting a frame from Pixi. The store fires exactly one emit per
// write so `useSyncExternalStore` stays cheap.

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

// Cap the LRU at roughly two film-strips worth of thumbs. We evict from
// the front of the insertion-ordered Map (oldest first) when the byte
// budget is exceeded.
const MAX_ENTRIES = 64;
const MAX_BYTES = 2 * 1024 * 1024; // 2 MB

let state: CommitThumbnailsState = {
  byShortSha: new Map(),
  totalBytes: 0,
};

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

function getState(): CommitThumbnailsState { return state; }

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function getThumbnail(shortSha: string): CommitThumbnail | undefined {
  return state.byShortSha.get(shortSha);
}

function sizeOf(t: CommitThumbnail): number {
  // data-URL byte cost is ~3/4 of the base64 string length.
  return t.dataUrl ? Math.ceil(t.dataUrl.length * 0.75) : 0;
}

/**
 * Write a thumbnail. Evicts older entries if either the entry cap or
 * byte cap is exceeded. Writes that match the existing entry's
 * fingerprint are skipped so camera-stable scrubs don't rotate the
 * LRU order pointlessly.
 */
function capture(shortSha: string, thumb: CommitThumbnail): void {
  const existing = state.byShortSha.get(shortSha);
  if (existing?.fingerprint && existing.fingerprint === thumb.fingerprint) {
    return;
  }

  const nextMap = new Map(state.byShortSha);
  let nextBytes = state.totalBytes;
  if (existing) nextBytes -= sizeOf(existing);
  nextMap.delete(shortSha); // re-insert at tail → LRU freshness
  nextMap.set(shortSha, thumb);
  nextBytes += sizeOf(thumb);

  // LRU eviction. Map iteration is insertion-ordered so the first key
  // is the oldest. Evict until both caps hold.
  while (
    (nextMap.size > MAX_ENTRIES || nextBytes > MAX_BYTES) &&
    nextMap.size > 1
  ) {
    const oldestKey = nextMap.keys().next().value as string | undefined;
    if (!oldestKey) break;
    const oldest = nextMap.get(oldestKey);
    if (oldest) nextBytes -= sizeOf(oldest);
    nextMap.delete(oldestKey);
  }

  state = { byShortSha: nextMap, totalBytes: Math.max(0, nextBytes) };
  emit();
}

function reset(): void {
  if (state.byShortSha.size === 0 && state.totalBytes === 0) return;
  state = { byShortSha: new Map(), totalBytes: 0 };
  emit();
}

export const commitThumbnailsStore = {
  getState,
  subscribe,
  getThumbnail,
  capture,
  reset,
};

export function useCommitThumbnail(shortSha: string | undefined): CommitThumbnail | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (shortSha ? state.byShortSha.get(shortSha) : undefined),
    () => (shortSha ? state.byShortSha.get(shortSha) : undefined),
  );
}
