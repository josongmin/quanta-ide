import { useSyncExternalStore } from "react";

export type StickyColor = "yellow" | "pink" | "green" | "blue" | "lilac";

export interface Sticky {
  id: string;
  x: number;
  y: number;
  width: number;
  height: number;
  text: string;
  color: StickyColor;
  author: string;
  createdAt: number;
  updatedAt: number;
  anchorFileId?: string;
  resolved?: boolean;
}

export interface StickiesState {
  stickies: readonly Sticky[];
  activeId: string | null;
}

export interface CreateStickyOpts {
  text?: string;
  color?: StickyColor;
  width?: number;
  height?: number;
  author?: string;
  anchorFileId?: string;
}

const DEFAULT_WIDTH = 180;
const DEFAULT_HEIGHT = 120;
const DEFAULT_COLOR: StickyColor = "yellow";
const DEFAULT_AUTHOR = "you";

const COLOR_CYCLE: readonly StickyColor[] = ["yellow", "pink", "green", "blue", "lilac"] as const;

let state: StickiesState = {
  stickies: [],
  activeId: null,
};

const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
}

function getState(): StickiesState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

let idCounter = 0;
function makeId(): string {
  idCounter += 1;
  const rand = Math.floor(Math.random() * 0xffffff).toString(36);
  return `sticky_${Date.now().toString(36)}_${idCounter.toString(36)}_${rand}`;
}

const actions = {
  create(x: number, y: number, opts?: CreateStickyOpts): string {
    const id = makeId();
    const now = Date.now();
    const sticky: Sticky = {
      id,
      x,
      y,
      width: opts?.width ?? DEFAULT_WIDTH,
      height: opts?.height ?? DEFAULT_HEIGHT,
      text: opts?.text ?? "",
      color: opts?.color ?? DEFAULT_COLOR,
      author: opts?.author ?? DEFAULT_AUTHOR,
      createdAt: now,
      updatedAt: now,
      anchorFileId: opts?.anchorFileId,
      resolved: false,
    };
    state = {
      stickies: [...state.stickies, sticky],
      activeId: id,
    };
    emit();
    return id;
  },

  update(id: string, patch: Partial<Omit<Sticky, "id" | "createdAt">>) {
    let changed = false;
    const next = state.stickies.map(s => {
      if (s.id !== id) return s;
      changed = true;
      return { ...s, ...patch, id: s.id, createdAt: s.createdAt, updatedAt: Date.now() };
    });
    if (!changed) return;
    state = { ...state, stickies: next };
    emit();
  },

  remove(id: string) {
    const next = state.stickies.filter(s => s.id !== id);
    if (next.length === state.stickies.length) return;
    state = {
      stickies: next,
      activeId: state.activeId === id ? null : state.activeId,
    };
    emit();
  },

  setActive(id: string | null) {
    if (state.activeId === id) return;
    state = { ...state, activeId: id };
    emit();
  },

  setPosition(id: string, x: number, y: number) {
    let changed = false;
    const next = state.stickies.map(s => {
      if (s.id !== id) return s;
      if (s.x === x && s.y === y) return s;
      changed = true;
      return { ...s, x, y, updatedAt: Date.now() };
    });
    if (!changed) return;
    state = { ...state, stickies: next };
    emit();
  },

  toggleResolved(id: string) {
    let changed = false;
    const next = state.stickies.map(s => {
      if (s.id !== id) return s;
      changed = true;
      return { ...s, resolved: !s.resolved, updatedAt: Date.now() };
    });
    if (!changed) return;
    state = { ...state, stickies: next };
    emit();
  },

  cycleColor(id: string) {
    let changed = false;
    const next = state.stickies.map(s => {
      if (s.id !== id) return s;
      const i = COLOR_CYCLE.indexOf(s.color);
      const nextColor = COLOR_CYCLE[(i + 1) % COLOR_CYCLE.length];
      changed = true;
      return { ...s, color: nextColor, updatedAt: Date.now() };
    });
    if (!changed) return;
    state = { ...state, stickies: next };
    emit();
  },

  reset(stickies: readonly Sticky[]) {
    state = { stickies, activeId: null };
    emit();
  },
};

export const stickiesStore = { getState, subscribe, ...actions };

export const STICKY_COLORS: readonly StickyColor[] = COLOR_CYCLE;

export function useStickiesStore<T>(selector: (s: StickiesState) => T): T {
  return useSyncExternalStore(
    stickiesStore.subscribe,
    () => selector(stickiesStore.getState()),
    () => selector(stickiesStore.getState()),
  );
}
