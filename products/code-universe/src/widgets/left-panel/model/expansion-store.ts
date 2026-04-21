import { useSyncExternalStore } from "react";

// Explorer expansion store
// --------------------------------------------------------------------
// Shared expansion state so the Explorer tree can follow the canvas.
// When the user drills into a galaxy / street / file on the canvas,
// `revealChain` walks that entity's ancestor chain and opens every
// folder in the explorer, and the corresponding row scrolls itself
// into view. The user can still manually collapse / expand — those
// edits persist until the next canvas drill, then the chain is
// re-revealed on top of whatever they set.
//
// Kept as an external store instead of React state so the sync
// effect inside LeftPanel can drive it without prop-drilling through
// the recursive <EntityTreeItem> tree. Also means a very deep tree
// with hundreds of rows doesn't re-render on unrelated state flips —
// each row subscribes to the bit it cares about.

let expanded: Set<string> = new Set();
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

export const expansionStore = {
  getState(): { expanded: ReadonlySet<string> } {
    return { expanded };
  },

  isExpanded(id: string): boolean {
    return expanded.has(id);
  },

  setExpanded(id: string, next: boolean): void {
    const has = expanded.has(id);
    if (has === next) return;
    const copy = new Set(expanded);
    if (next) copy.add(id);
    else copy.delete(id);
    expanded = copy;
    emit();
  },

  toggle(id: string): void {
    this.setExpanded(id, !expanded.has(id));
  },

  /** Ensure every id in `ids` is expanded. Skips an emit when the
   *  set is already fully present. */
  revealChain(ids: readonly string[]): void {
    let dirty = false;
    const copy = new Set(expanded);
    for (const id of ids) {
      if (!copy.has(id)) {
        copy.add(id);
        dirty = true;
      }
    }
    if (!dirty) return;
    expanded = copy;
    emit();
  },

  reset(): void {
    if (expanded.size === 0) return;
    expanded = new Set();
    emit();
  },

  subscribe,
};

export function useIsExpanded(id: string): boolean {
  return useSyncExternalStore(
    subscribe,
    () => expanded.has(id),
    () => expanded.has(id),
  );
}
