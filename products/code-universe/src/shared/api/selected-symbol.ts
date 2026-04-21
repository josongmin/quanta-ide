import { useSyncExternalStore } from "react";

// Selected-symbol source
// --------------------------------------------------------------------
// Sibling of `graph-source.ts` and `repo-root.ts`. Holds the currently
// selected `SymbolNode.id` (encoded as `${fileId}:${name}@${line}`) so
// canvas views can narrow their layout to the symbol's incoming /
// outgoing edges when the inspector (in the host) selects a symbol.
//
// Set from the host via `installCodeUniverseBridge` subscribing to the
// app-ide `interactionStore`. Consumed by any view that wants to
// refocus on a symbol — `NeighborhoodView`, `MindMapView`, etc. Null
// ⇒ no symbol is selected, fall back to file-tier centering.
//
// Design parity: module singleton, not context — the TabAppDescriptor
// contract only passes `{ tabId, isActive }`, so a React provider is
// not reachable from the host shell without breaking product-isolation.

let current: string | null = null;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

export function setSelectedSymbol(next: string | null): void {
  if (current === next) return;
  current = next;
  emit();
}

export function getSelectedSymbol(): string | null {
  return current;
}

export function subscribeSelectedSymbol(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export function useSelectedSymbol(): string | null {
  return useSyncExternalStore(
    subscribeSelectedSymbol,
    getSelectedSymbol,
    getSelectedSymbol,
  );
}
