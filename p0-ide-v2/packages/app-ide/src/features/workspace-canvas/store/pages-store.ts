import { useSyncExternalStore } from "react";

// Pages store (Batch 5 — Navigation)
// -------------------------------------------------------------------
// A canvas "Page" is a Figma-style lightweight tab — each page owns
// its own viewport + selection so the user can split thematic work
// (e.g. "API surface" vs. "Security review") across independent
// sub-canvases without touching routing.
//
// The store is intentionally narrow: it only tracks identity +
// per-page state. The orchestrator (`use-page-switch`) reads this
// store and pushes viewport / selection into the hot sub-stores on
// page switches, so those stores stay oblivious to page identity.
//
// Persistence: `localStorage` at `STORAGE_KEY`. Invalid / missing
// data falls back to a single default `"Main"` page so the canvas
// always has somewhere to render.

const STORAGE_KEY = "quanta.canvas.pages.v1";

export interface CanvasPageViewport {
  x: number;
  y: number;
  scale: number;
}

export interface CanvasPage {
  /** Stable (never renamed). Used to anchor bookmarks + templates. */
  id: string;
  label: string;
  createdAt: number;
  viewport: CanvasPageViewport;
  selectedFileId: string | null;
  description?: string;
}

export interface PagesState {
  pages: readonly CanvasPage[];
  activeId: string;
}

const DEFAULT_VIEWPORT: CanvasPageViewport = { x: 0, y: 0, scale: 0.1 };

function makeId(): string {
  return `page_${Date.now().toString(36)}_${Math.floor(Math.random() * 0xffffff).toString(36)}`;
}

function defaultPage(): CanvasPage {
  return {
    id: "page_main",
    label: "Main",
    createdAt: Date.now(),
    viewport: { ...DEFAULT_VIEWPORT },
    selectedFileId: null,
  };
}

function defaultState(): PagesState {
  const p = defaultPage();
  return { pages: [p], activeId: p.id };
}

function readPersisted(): PagesState | null {
  try {
    const raw = typeof localStorage === "undefined" ? null : localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const rawPages: unknown = (parsed as { pages?: unknown }).pages;
    if (!Array.isArray(rawPages) || rawPages.length === 0) return null;
    const pages: CanvasPage[] = [];
    for (const p of rawPages) {
      if (!p || typeof p !== "object") continue;
      const rec = p as Record<string, unknown>;
      const id = typeof rec.id === "string" ? rec.id : null;
      const label = typeof rec.label === "string" ? rec.label : null;
      if (!id || !label) continue;
      const vpRaw = rec.viewport as Record<string, unknown> | undefined;
      const viewport: CanvasPageViewport = {
        x: typeof vpRaw?.x === "number" ? vpRaw.x : DEFAULT_VIEWPORT.x,
        y: typeof vpRaw?.y === "number" ? vpRaw.y : DEFAULT_VIEWPORT.y,
        scale: typeof vpRaw?.scale === "number" ? vpRaw.scale : DEFAULT_VIEWPORT.scale,
      };
      pages.push({
        id,
        label,
        createdAt: typeof rec.createdAt === "number" ? rec.createdAt : Date.now(),
        viewport,
        selectedFileId: typeof rec.selectedFileId === "string" ? rec.selectedFileId : null,
        description: typeof rec.description === "string" ? rec.description : undefined,
      });
    }
    if (pages.length === 0) return null;
    const activeRaw = typeof (parsed as { activeId?: unknown }).activeId === "string"
      ? (parsed as { activeId: string }).activeId
      : null;
    const activeId = activeRaw && pages.some(p => p.id === activeRaw) ? activeRaw : pages[0]!.id;
    return { pages, activeId };
  } catch {
    return null;
  }
}

function writePersisted(s: PagesState): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // best-effort
  }
}

let state: PagesState = readPersisted() ?? defaultState();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

function getState(): PagesState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function setState(next: PagesState): void {
  state = next;
  writePersisted(next);
  emit();
}

export interface CreatePageOpts {
  /** Explicit id to use (templates pre-compute ids to wire bookmarks). */
  id?: string;
  viewport?: CanvasPageViewport;
  selectedFileId?: string | null;
  description?: string;
}

const actions = {
  create(label: string, opts?: CreatePageOpts): string {
    const id = opts?.id ?? makeId();
    const page: CanvasPage = {
      id,
      label: label.trim() || "Untitled",
      createdAt: Date.now(),
      viewport: opts?.viewport ? { ...opts.viewport } : { ...DEFAULT_VIEWPORT },
      selectedFileId: opts?.selectedFileId ?? null,
      description: opts?.description,
    };
    setState({ pages: [...state.pages, page], activeId: id });
    return id;
  },

  rename(id: string, label: string): void {
    const trimmed = label.trim();
    if (!trimmed) return;
    let changed = false;
    const next = state.pages.map(p => {
      if (p.id !== id || p.label === trimmed) return p;
      changed = true;
      return { ...p, label: trimmed };
    });
    if (!changed) return;
    setState({ ...state, pages: next });
  },

  remove(id: string): void {
    if (state.pages.length <= 1) return; // never drop the last page
    const remaining = state.pages.filter(p => p.id !== id);
    if (remaining.length === state.pages.length) return;
    const activeId = state.activeId === id ? remaining[0]!.id : state.activeId;
    setState({ pages: remaining, activeId });
  },

  setActive(id: string): void {
    if (state.activeId === id) return;
    if (!state.pages.some(p => p.id === id)) return;
    setState({ ...state, activeId: id });
  },

  updatePageState(id: string, patch: Partial<Omit<CanvasPage, "id" | "createdAt">>): void {
    let changed = false;
    const next = state.pages.map(p => {
      if (p.id !== id) return p;
      changed = true;
      return {
        ...p,
        ...patch,
        id: p.id,
        createdAt: p.createdAt,
        viewport: patch.viewport ? { ...patch.viewport } : p.viewport,
      };
    });
    if (!changed) return;
    setState({ ...state, pages: next });
  },

  /** Test / reset helper. */
  resetToDefault(): void {
    setState(defaultState());
  },
};

export const pagesStore = {
  getState,
  subscribe,
  ...actions,
};

export function usePagesStore<T>(selector: (s: PagesState) => T): T {
  return useSyncExternalStore(
    pagesStore.subscribe,
    () => selector(pagesStore.getState()),
    () => selector(pagesStore.getState()),
  );
}

export function getActivePage(s: PagesState = state): CanvasPage {
  return s.pages.find(p => p.id === s.activeId) ?? s.pages[0]!;
}
