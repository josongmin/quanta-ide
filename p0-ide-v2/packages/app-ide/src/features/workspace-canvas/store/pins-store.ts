import { useSyncExternalStore } from "react";

// Investigation pins store (R4)
// -------------------------------------------------------------------
// Tiny persistence-free store that holds user-pinned entities for the
// Investigate mode board. Pin kinds mirror the three navigation units
// the shell operates on: file, edge (evidence), and path (A→B path
// query result). Each pin carries a free-form note so users can
// annotate findings inline.
//
// We deliberately don't persist to localStorage — the board is a
// session-scoped scratchpad; adding persistence brings race/versioning
// concerns that the user hasn't asked for yet. A later `investigate.
// persist` flag can back this with localStorage or shareable URL.

export type PinKind = "file" | "edge" | "path";

export interface Pin {
  id: string;
  kind: PinKind;
  /** Canonical target id — fileId for file pins, evidenceId for edge
   *  pins, `${from}→${to}` for path pins. */
  target: string;
  /** Display label — falls back to the target when absent. */
  label?: string;
  /** Free-form note the user writes. */
  note: string;
  /** Epoch ms; stable sort anchor for the board. */
  createdAt: number;
}

export interface PinsState {
  pins: readonly Pin[];
}

let state: PinsState = { pins: [] };
const listeners = new Set<() => void>();

let nextIdSeq = 1;
function newId(): string {
  return `pin-${Date.now().toString(36)}-${(nextIdSeq++).toString(36)}`;
}

function emit(): void { for (const l of [...listeners]) l(); }
function getState(): PinsState { return state; }
function subscribe(l: () => void): () => void {
  listeners.add(l);
  return () => { listeners.delete(l); };
}

function add(input: Omit<Pin, "id" | "createdAt">): Pin {
  const pin: Pin = {
    ...input,
    id: newId(),
    createdAt: Date.now(),
  };
  state = { pins: [...state.pins, pin] };
  emit();
  return pin;
}

function remove(id: string): void {
  const next = state.pins.filter(p => p.id !== id);
  if (next.length === state.pins.length) return;
  state = { pins: next };
  emit();
}

function setNote(id: string, note: string): void {
  let changed = false;
  const next = state.pins.map(p => {
    if (p.id !== id || p.note === note) return p;
    changed = true;
    return { ...p, note };
  });
  if (!changed) return;
  state = { pins: next };
  emit();
}

function reset(): void {
  if (state.pins.length === 0) return;
  state = { pins: [] };
  emit();
}

export const pinsStore = {
  getState,
  subscribe,
  add,
  remove,
  setNote,
  reset,
};

export function usePinsStore<T>(selector: (s: PinsState) => T): T {
  return useSyncExternalStore(
    pinsStore.subscribe,
    () => selector(pinsStore.getState()),
    () => selector(pinsStore.getState()),
  );
}
