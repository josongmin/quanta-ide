import { useSyncExternalStore } from "react";

// Canvas images store — Batch 8 (embeds.imagePaste)
// ----------------------------------------------------------------------
// Stores images pasted from the system clipboard onto the canvas. Each
// entry is world-positioned and carries its own base64 data URL so the
// image survives a reload without any network.
//
// Persistence is best-effort localStorage. Caps keep the shared
// per-origin quota livable:
//   - max 1 MB per image (decoded data-URL byte-length bound)
//   - max 5 images at any one time
// Any paste over those caps is rejected via the `CapResult`; the caller
// surfaces a toast.

export interface CanvasImage {
  id: string;
  /** World x in canvas coords (top-left). */
  x: number;
  /** World y in canvas coords (top-left). */
  y: number;
  /** World width (display size). */
  w: number;
  /** World height (display size). */
  h: number;
  /** base64 data URL (image/png, image/jpeg, …). */
  dataUrl: string;
  caption?: string;
  createdAt: number;
  locked?: boolean;
  anchorFileId?: string;
}

export type CapResult =
  | { ok: true }
  | { ok: false; reason: "too-large" | "too-many"; sizeBytes?: number };

/** Per-image cap — 1 MB of base64 payload. Gives ~750 KB of raw bytes. */
export const IMAGE_MAX_BYTES = 1024 * 1024;
/** Hard cap on the total number of canvas images. */
export const IMAGE_MAX_COUNT = 5;

const STORAGE_KEY = "quanta.canvas.images.v1";

export interface ImagesState {
  readonly images: readonly CanvasImage[];
  readonly activeId: string | null;
}

const initial: ImagesState = { images: [], activeId: null };

let state: ImagesState = readPersisted() ?? initial;

const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getState(): ImagesState {
  return state;
}

// ── Persistence ───────────────────────────────────────────────────────

function readPersisted(): ImagesState | null {
  try {
    if (typeof localStorage === "undefined") return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed: unknown = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const maybeImages = (parsed as { images?: unknown }).images;
    if (!Array.isArray(maybeImages)) return null;
    const out: CanvasImage[] = [];
    for (const row of maybeImages) {
      if (!isCanvasImage(row)) continue;
      out.push(row);
    }
    return { images: out, activeId: null };
  } catch {
    return null;
  }
}

function writePersisted(next: readonly CanvasImage[]): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ images: next }));
  } catch {
    // Quota or serialization failure — best-effort; state stays in memory.
  }
}

function isCanvasImage(v: unknown): v is CanvasImage {
  if (!v || typeof v !== "object") return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.id === "string" &&
    typeof r.x === "number" &&
    typeof r.y === "number" &&
    typeof r.w === "number" &&
    typeof r.h === "number" &&
    typeof r.dataUrl === "string" &&
    typeof r.createdAt === "number"
  );
}

// ── Id generator ──────────────────────────────────────────────────────

let idCounter = 0;
function makeId(): string {
  idCounter += 1;
  const rand = Math.floor(Math.random() * 0xffffff).toString(36);
  return `img_${Date.now().toString(36)}_${idCounter.toString(36)}_${rand}`;
}

// ── Size check ────────────────────────────────────────────────────────

/** Approximate decoded byte count for a base64 data URL. */
export function approxDataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  const base64 = comma >= 0 ? dataUrl.slice(comma + 1) : dataUrl;
  // each 4 base64 chars → 3 bytes; approximate.
  return Math.floor((base64.length * 3) / 4);
}

// ── Actions ───────────────────────────────────────────────────────────

export interface AddImageOpts {
  x: number;
  y: number;
  w: number;
  h: number;
  dataUrl: string;
  caption?: string;
  anchorFileId?: string;
}

function tryAdd(opts: AddImageOpts): CapResult & { id?: string } {
  const sizeBytes = approxDataUrlBytes(opts.dataUrl);
  if (sizeBytes > IMAGE_MAX_BYTES) {
    return { ok: false, reason: "too-large", sizeBytes };
  }
  if (state.images.length >= IMAGE_MAX_COUNT) {
    return { ok: false, reason: "too-many" };
  }
  const id = makeId();
  const now = Date.now();
  const image: CanvasImage = {
    id,
    x: opts.x,
    y: opts.y,
    w: opts.w,
    h: opts.h,
    dataUrl: opts.dataUrl,
    caption: opts.caption,
    createdAt: now,
    anchorFileId: opts.anchorFileId,
  };
  const next = [...state.images, image];
  state = { images: next, activeId: id };
  writePersisted(next);
  emit();
  return { ok: true, id };
}

function remove(id: string): void {
  const next = state.images.filter(i => i.id !== id);
  if (next.length === state.images.length) return;
  state = {
    images: next,
    activeId: state.activeId === id ? null : state.activeId,
  };
  writePersisted(next);
  emit();
}

function update(id: string, patch: Partial<Omit<CanvasImage, "id" | "createdAt" | "dataUrl">>): void {
  let changed = false;
  const next = state.images.map(i => {
    if (i.id !== id) return i;
    if (i.locked && (patch.x !== undefined || patch.y !== undefined || patch.w !== undefined || patch.h !== undefined)) {
      return i;
    }
    changed = true;
    return { ...i, ...patch };
  });
  if (!changed) return;
  state = { ...state, images: next };
  writePersisted(next);
  emit();
}

function setPosition(id: string, x: number, y: number): void {
  update(id, { x, y });
}

function setSize(id: string, w: number, h: number): void {
  update(id, { w: Math.max(40, w), h: Math.max(40, h) });
}

function setCaption(id: string, caption: string): void {
  update(id, { caption });
}

function toggleLocked(id: string): void {
  let changed = false;
  const next = state.images.map(i => {
    if (i.id !== id) return i;
    changed = true;
    return { ...i, locked: !i.locked };
  });
  if (!changed) return;
  state = { ...state, images: next };
  writePersisted(next);
  emit();
}

function setActive(id: string | null): void {
  if (state.activeId === id) return;
  state = { ...state, activeId: id };
  emit();
}

function reset(): void {
  state = initial;
  writePersisted([]);
  emit();
}

export const imagesStore = {
  getState,
  subscribe,
  tryAdd,
  remove,
  update,
  setPosition,
  setSize,
  setCaption,
  toggleLocked,
  setActive,
  reset,
};

export function useImagesStore<T>(selector: (s: ImagesState) => T): T {
  return useSyncExternalStore(
    imagesStore.subscribe,
    () => selector(imagesStore.getState()),
    () => selector(imagesStore.getState()),
  );
}
