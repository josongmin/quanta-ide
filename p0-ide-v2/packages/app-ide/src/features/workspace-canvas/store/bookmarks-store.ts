import { useSyncExternalStore } from "react";

// Bookmarks store (Batch 5 — Navigation)
// -------------------------------------------------------------------
// A Bookmark is a "named view": a saved snapshot of (camera + filter
// state) scoped to a page. Storyboard plays through these in order.
//
// Persistence: `localStorage`. Corrupt records are skipped, not
// rejected wholesale — keep bookmarks the user still has.

const STORAGE_KEY = "quanta.canvas.bookmarks.v1";

export interface BookmarkCameraState {
  x: number;
  y: number;
  scale: number;
}

/**
 * Minimal snapshot of filter state — keep this small. When a bookmark
 * is applied, each specified field is pushed through the correct
 * store; unspecified fields are left alone (no reset surprises).
 */
export interface BookmarkFilterState {
  edgeFilterQuery?: string;
  focusFileId?: string | null;
}

export interface Bookmark {
  id: string;
  pageId: string;
  label: string;
  /** Optional base64 PNG data-URL for the thumbnail grid. */
  thumbnail?: string;
  cameraState: BookmarkCameraState;
  filterState?: BookmarkFilterState;
  createdAt: number;
  /** Monotonic within (pageId); storyboard playback walks ascending. */
  order: number;
}

export interface BookmarksState {
  bookmarks: readonly Bookmark[];
}

function makeId(): string {
  return `bm_${Date.now().toString(36)}_${Math.floor(Math.random() * 0xffffff).toString(36)}`;
}

function readPersisted(): BookmarksState | null {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const rawArr: unknown = (parsed as { bookmarks?: unknown }).bookmarks;
    if (!Array.isArray(rawArr)) return null;
    const out: Bookmark[] = [];
    for (const b of rawArr) {
      if (!b || typeof b !== "object") continue;
      const rec = b as Record<string, unknown>;
      const id = typeof rec.id === "string" ? rec.id : null;
      const pageId = typeof rec.pageId === "string" ? rec.pageId : null;
      const label = typeof rec.label === "string" ? rec.label : null;
      if (!id || !pageId || !label) continue;
      const cam = rec.cameraState as Record<string, unknown> | undefined;
      if (
        !cam ||
        typeof cam.x !== "number" ||
        typeof cam.y !== "number" ||
        typeof cam.scale !== "number"
      ) {
        continue;
      }
      const filter = rec.filterState as Record<string, unknown> | undefined;
      const filterState: BookmarkFilterState | undefined = filter
        ? {
            edgeFilterQuery:
              typeof filter.edgeFilterQuery === "string" ? filter.edgeFilterQuery : undefined,
            focusFileId:
              typeof filter.focusFileId === "string"
                ? filter.focusFileId
                : filter.focusFileId === null
                  ? null
                  : undefined,
          }
        : undefined;
      out.push({
        id,
        pageId,
        label,
        thumbnail: typeof rec.thumbnail === "string" ? rec.thumbnail : undefined,
        cameraState: { x: cam.x, y: cam.y, scale: cam.scale },
        filterState,
        createdAt: typeof rec.createdAt === "number" ? rec.createdAt : Date.now(),
        order: typeof rec.order === "number" ? rec.order : 0,
      });
    }
    return { bookmarks: out };
  } catch {
    return null;
  }
}

function writePersisted(s: BookmarksState): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // best-effort
  }
}

let state: BookmarksState = readPersisted() ?? { bookmarks: [] };
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

function getState(): BookmarksState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setState(next: BookmarksState): void {
  state = next;
  writePersisted(next);
  emit();
}

function nextOrderFor(pageId: string): number {
  let max = -1;
  for (const b of state.bookmarks) {
    if (b.pageId === pageId && b.order > max) max = b.order;
  }
  return max + 1;
}

export interface CreateBookmarkInput {
  pageId: string;
  label: string;
  cameraState: BookmarkCameraState;
  filterState?: BookmarkFilterState;
  thumbnail?: string;
  /** Optional explicit id (template wiring). */
  id?: string;
  /** Optional explicit order (template wiring). */
  order?: number;
}

const actions = {
  create(input: CreateBookmarkInput): string {
    const id = input.id ?? makeId();
    const bm: Bookmark = {
      id,
      pageId: input.pageId,
      label: input.label.trim() || "Untitled view",
      cameraState: { ...input.cameraState },
      filterState: input.filterState ? { ...input.filterState } : undefined,
      thumbnail: input.thumbnail,
      createdAt: Date.now(),
      order: typeof input.order === "number" ? input.order : nextOrderFor(input.pageId),
    };
    setState({ bookmarks: [...state.bookmarks, bm] });
    return id;
  },

  update(id: string, patch: Partial<Omit<Bookmark, "id" | "createdAt" | "pageId">>): void {
    let changed = false;
    const next = state.bookmarks.map(b => {
      if (b.id !== id) return b;
      changed = true;
      return {
        ...b,
        ...patch,
        id: b.id,
        createdAt: b.createdAt,
        pageId: b.pageId,
      };
    });
    if (!changed) return;
    setState({ bookmarks: next });
  },

  remove(id: string): void {
    const next = state.bookmarks.filter(b => b.id !== id);
    if (next.length === state.bookmarks.length) return;
    setState({ bookmarks: next });
  },

  removeForPage(pageId: string): void {
    const next = state.bookmarks.filter(b => b.pageId !== pageId);
    if (next.length === state.bookmarks.length) return;
    setState({ bookmarks: next });
  },

  reorder(pageId: string, orderedIds: readonly string[]): void {
    // Reassign `order` based on the given sequence; leave other pages' data alone.
    const indexOf = new Map<string, number>();
    orderedIds.forEach((id, i) => indexOf.set(id, i));
    let changed = false;
    const next = state.bookmarks.map(b => {
      if (b.pageId !== pageId) return b;
      const nextOrder = indexOf.get(b.id);
      if (typeof nextOrder !== "number" || nextOrder === b.order) return b;
      changed = true;
      return { ...b, order: nextOrder };
    });
    if (!changed) return;
    setState({ bookmarks: next });
  },

  /** Test helper. */
  reset(bookmarks: readonly Bookmark[] = []): void {
    setState({ bookmarks });
  },
};

export const bookmarksStore = {
  getState,
  subscribe,
  ...actions,
};

export function useBookmarksStore<T>(selector: (s: BookmarksState) => T): T {
  return useSyncExternalStore(
    bookmarksStore.subscribe,
    () => selector(bookmarksStore.getState()),
    () => selector(bookmarksStore.getState()),
  );
}

export function bookmarksForPage(
  s: BookmarksState,
  pageId: string,
): readonly Bookmark[] {
  return [...s.bookmarks]
    .filter(b => b.pageId === pageId)
    .sort((a, b) => a.order - b.order);
}
