import { useSyncExternalStore } from "react";
import {
  listMockTickets,
  MOCK_TICKETS_BY_ID,
  type Ticket,
} from "../lib/mock-tickets";

// Ticket links store — Batch 8 (embeds.tickets)
// ----------------------------------------------------------------------
// Maps fileId → ticketId[]. Tickets come from `mock-tickets.ts`. The
// store keeps only the link relation (which tickets hang off which
// files) so the same ticket can appear under multiple files (e.g., a
// cross-cutting refactor).
//
// Not persisted — re-derived from the mock fixture on every load.

interface LinksState {
  readonly byFile: ReadonlyMap<string, readonly string[]>;
}

const initial: LinksState = { byFile: new Map() };

let state: LinksState = initial;

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

function getState(): LinksState {
  return state;
}

function listFor(fileId: string): readonly Ticket[] {
  const ids = state.byFile.get(fileId);
  if (!ids || ids.length === 0) return [];
  const out: Ticket[] = [];
  for (const id of ids) {
    const t = MOCK_TICKETS_BY_ID.get(id);
    if (t) out.push(t);
  }
  return out;
}

function link(fileId: string, ticketId: string): void {
  if (!MOCK_TICKETS_BY_ID.has(ticketId)) return;
  const existing = state.byFile.get(fileId) ?? [];
  if (existing.includes(ticketId)) return;
  const nextMap = new Map(state.byFile);
  nextMap.set(fileId, [...existing, ticketId]);
  state = { byFile: nextMap };
  emit();
}

function unlink(fileId: string, ticketId: string): void {
  const existing = state.byFile.get(fileId);
  if (!existing) return;
  const filtered = existing.filter(id => id !== ticketId);
  if (filtered.length === existing.length) return;
  const nextMap = new Map(state.byFile);
  if (filtered.length === 0) nextMap.delete(fileId);
  else nextMap.set(fileId, filtered);
  state = { byFile: nextMap };
  emit();
}

/**
 * Seed the store from the mock fixture using the supplied graph file
 * ids. The link fan-out is a prime-stride walk so every ticket lands
 * on at least one file and the output is deterministic across reloads.
 */
function seedFromFileIds(fileIds: readonly string[]): void {
  if (fileIds.length === 0) return;
  const nextMap = new Map<string, string[]>();
  const tickets = listMockTickets();
  const stride = 7; // prime — spreads links across the file list
  tickets.forEach((t, i) => {
    const fid = fileIds[(i * stride) % fileIds.length];
    if (!fid) return;
    const row = nextMap.get(fid) ?? [];
    if (!row.includes(t.id)) row.push(t.id);
    nextMap.set(fid, row);
  });
  // Ensure the top-risk-style file (index 0) has ENG-142 so the demo
  // hits the "Refactor auth flow linked to top-risk file" copy.
  const first = fileIds[0];
  if (first) {
    const row = nextMap.get(first) ?? [];
    if (!row.includes("t-eng-142")) row.unshift("t-eng-142");
    nextMap.set(first, row);
  }
  state = { byFile: nextMap };
  emit();
}

function reset(): void {
  state = initial;
  emit();
}

export const ticketLinksStore = {
  getState,
  subscribe,
  listFor,
  link,
  unlink,
  seedFromFileIds,
  reset,
};

export function useTicketLinksStore<T>(selector: (s: LinksState) => T): T {
  return useSyncExternalStore(
    ticketLinksStore.subscribe,
    () => selector(ticketLinksStore.getState()),
    () => selector(ticketLinksStore.getState()),
  );
}
