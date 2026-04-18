import { useSyncExternalStore } from "react";

// Commit thumbnails store (T1 — temporal data foundation)
// -------------------------------------------------------------------
// The film-strip / time-travel UI wants a tiny preview image per commit
// so the user can eyeball which commit changed what before jumping.
//
// Cache model:
//   * In-memory Map<shortSha, CommitThumbnail>  (LRU-ordered via
//     insertion; `get` re-inserts to refresh).
//   * Persisted to `localStorage` under STORAGE_KEY so revisits don't
//     need to re-render the canvas.
//
// Budget:
//   * MAX_ENTRY_BYTES  — per-entry ceiling (drops bloated captures).
//   * MAX_TOTAL_BYTES  — overall cap, evict LRU until new entry fits.
//
// API (keep back-compat with T2's placeholder):
//   - `CommitThumbnail` shape  — { sha, dataUrl?, capturedAt?, fingerprint? }
//   - `getThumbnail(shortSha)` / `set(shortSha, thumb)` / `clear()`
//   - `useCommitThumbnail(shortSha)` hook
//
// T1 additions:
//   - Automatic localStorage persistence with size cap + LRU eviction.
//   - `has` / `delete` helpers.
//   - `COMMIT_THUMBNAIL_LIMITS` export for downstream UI.

const STORAGE_KEY = "quanta.canvas.thumbnails.v1";

// 5 KB per thumbnail ceiling keeps a 160×96 PNG comfortable; anything
// larger is probably a screen-sized capture leaking through.
const MAX_ENTRY_BYTES = 5 * 1024;
// 50 × 5 KB = 250 KB total LRU budget. Stays well below the 5 MB
// localStorage quota even on conservative browsers.
const MAX_TOTAL_BYTES = 50 * MAX_ENTRY_BYTES;

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

function entryBytes(thumb: CommitThumbnail): number {
  // Approximate — the `dataUrl` dominates. Ignore the tiny overhead of
  // sha / timestamp for the budget.
  return thumb.dataUrl ? thumb.dataUrl.length : 0;
}

function readPersisted(): CommitThumbnailsState | null {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { entries?: unknown };
    if (!parsed || typeof parsed !== "object") return null;
    const rawEntries = parsed.entries;
    if (!Array.isArray(rawEntries)) return null;
    const map = new Map<string, CommitThumbnail>();
    let total = 0;
    for (const pair of rawEntries) {
      if (!Array.isArray(pair) || pair.length !== 2) continue;
      const [shortSha, thumbRaw] = pair;
      if (typeof shortSha !== "string" || !thumbRaw || typeof thumbRaw !== "object") continue;
      const tr = thumbRaw as Record<string, unknown>;
      const sha = typeof tr.sha === "string" ? tr.sha : null;
      if (!sha) continue;
      const thumb: CommitThumbnail = {
        sha,
        dataUrl: typeof tr.dataUrl === "string" ? tr.dataUrl : undefined,
        capturedAt: typeof tr.capturedAt === "number" ? tr.capturedAt : undefined,
        fingerprint: typeof tr.fingerprint === "string" ? tr.fingerprint : undefined,
      };
      const bytes = entryBytes(thumb);
      if (bytes > MAX_ENTRY_BYTES) continue;
      map.set(shortSha, thumb);
      total += bytes;
      if (total > MAX_TOTAL_BYTES) break;
    }
    return { byShortSha: map, totalBytes: total };
  } catch {
    return null;
  }
}

function writePersisted(s: CommitThumbnailsState): void {
  try {
    if (typeof localStorage === "undefined") return;
    const entries: [string, CommitThumbnail][] = [];
    for (const [k, v] of s.byShortSha) entries.push([k, v]);
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ entries }));
  } catch {
    // Best-effort — quota / disabled storage shouldn't crash the app.
  }
}

function emptyState(): CommitThumbnailsState {
  return { byShortSha: new Map(), totalBytes: 0 };
}

let state: CommitThumbnailsState = readPersisted() ?? emptyState();
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

/**
 * Evict least-recently-set entries until `totalBytes + incoming <= budget`.
 * Returns a new Map + running total so the caller can use it directly.
 */
function evictForBudget(
  existing: ReadonlyMap<string, CommitThumbnail>,
  existingBytes: number,
  incomingBytes: number,
): { map: Map<string, CommitThumbnail>; total: number } {
  const map = new Map(existing);
  let total = existingBytes;
  const iter = map.keys();
  while (total + incomingBytes > MAX_TOTAL_BYTES) {
    const next = iter.next();
    if (next.done) break;
    const key = next.value;
    const value = map.get(key);
    if (value == null) continue;
    total -= entryBytes(value);
    map.delete(key);
  }
  return { map, total };
}

const actions = {
  /**
   * Upsert a thumbnail. Returns true on success, false when the entry is
   * too large to cache (exceeds per-entry byte cap).
   */
  set(shortSha: string, thumb: CommitThumbnail): boolean {
    if (!shortSha || !thumb || typeof thumb.sha !== "string") return false;
    const bytes = entryBytes(thumb);
    if (bytes > MAX_ENTRY_BYTES) return false;
    const previous = state.byShortSha.get(shortSha);
    const baseMap = new Map(state.byShortSha);
    let baseBytes = state.totalBytes;
    if (previous) {
      baseMap.delete(shortSha);
      baseBytes -= entryBytes(previous);
    }
    const { map, total } = evictForBudget(baseMap, baseBytes, bytes);
    map.set(shortSha, thumb);
    state = { byShortSha: map, totalBytes: total + bytes };
    writePersisted(state);
    emit();
    return true;
  },

  has(shortSha: string): boolean {
    return state.byShortSha.has(shortSha);
  },

  delete(shortSha: string): boolean {
    const v = state.byShortSha.get(shortSha);
    if (!v) return false;
    const next = new Map(state.byShortSha);
    next.delete(shortSha);
    state = { byShortSha: next, totalBytes: state.totalBytes - entryBytes(v) };
    writePersisted(state);
    emit();
    return true;
  },

  clear(): void {
    if (state.byShortSha.size === 0) return;
    state = emptyState();
    writePersisted(state);
    emit();
  },
};

export const commitThumbnailsStore = {
  getState,
  subscribe,
  getThumbnail,
  ...actions,
};

export function useCommitThumbnail(shortSha: string | undefined): CommitThumbnail | undefined {
  return useSyncExternalStore(
    subscribe,
    () => (shortSha ? state.byShortSha.get(shortSha) : undefined),
    () => (shortSha ? state.byShortSha.get(shortSha) : undefined),
  );
}

/** Constants exported for downstream UI / tests. */
export const COMMIT_THUMBNAIL_LIMITS = {
  maxEntryBytes: MAX_ENTRY_BYTES,
  maxTotalBytes: MAX_TOTAL_BYTES,
} as const;
