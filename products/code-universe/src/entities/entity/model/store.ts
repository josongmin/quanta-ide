import { useRef, useSyncExternalStore } from "react";
import type { EntityTree } from "./types";

// Entity store
// --------------------------------------------------------------------
// Tiny hand-rolled external store for the entity tree + interaction
// state (selected, hovered). Mirrors the shape of the legacy
// `interactionStore` — same `subscribe` / `getState` contract so we
// can later unify the two without a consumer rewrite.
//
// Why not Zustand/Jotai/etc.: the product-wide rule from the memory
// layer is "one external-store pattern, minimal deps". The engine
// already works without a state library; adding one for a placeholder
// would violate the SOTA++ "no unearned dependency" rule.

export interface EntityInteraction {
  selectedId: string | null;
  hoveredId: string | null;
  /** Canvas focus mode.
   *  - 'none': overview — show every entity at the active tier.
   *  - 'neighborhood': scope the canvas to the `anchorId` entity.
   *    The adaptive filter in CanvasViewport picks the right shape
   *    (ego-graph when anchor is at the current tier, subtree when
   *    anchor lives above it) so drill-ins through tiers preserve
   *    the user's interest. */
  focusMode: "none" | "neighborhood";
  /** Scope entity. Distinct from `selectedId` so the user can click
   *  around WITHIN a scope without losing it — selection shifts to
   *  inspect a neighbour, anchor stays put so the visible set doesn't
   *  collapse beneath their cursor. Set by Explorer clicks, canvas
   *  drill-in (double-click / Inspector button), and the first
   *  selection out of an empty state. Cleared when focus ends. */
  anchorId: string | null;
  /** Street-tier inline expansion — the folder whose children render inside its rect; peers dim to thumbnails. */
  expandedFolderId: string | null;
  /** One-shot signal: pan the canvas to bring this entity into view without
   *  changing selection or tier. Fired by a debounced tree-hover (350 ms).
   *  Cleared by the consumer (CanvasViewport) after the tween starts, and by
   *  the tree item on mouse-leave so the same entity can be re-located. */
  locateId: string | null;
  /** Ancestor IDs (parent chain, excluding the hovered entity itself)
   *  of the currently hovered entity. Computed alongside hoveredId so
   *  collapsed Explorer rows can show a "contains hovered item"
   *  indicator without per-row tree traversal. Empty set when nothing
   *  is hovered. */
  hoveredAncestorIds: ReadonlySet<string>;
}

export interface EntityState {
  tree: EntityTree | null;
  interaction: EntityInteraction;
}

const EMPTY_SET: ReadonlySet<string> = new Set();

const initial: EntityState = {
  tree: null,
  interaction: {
    selectedId: null,
    hoveredId: null,
    focusMode: "none",
    anchorId: null,
    expandedFolderId: null,
    locateId: null,
    hoveredAncestorIds: EMPTY_SET,
  },
};

let state: EntityState = initial;
const listeners = new Set<() => void>();

function emit(): void {
  for (const l of [...listeners]) l();
}

export const entityStore = {
  getState(): EntityState {
    return state;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  setTree(tree: EntityTree | null): void {
    if (state.tree === tree) return;
    // A new tree invalidates any Street-tier expansion — the old folder
    // id may not exist in the new structure, so reset it defensively.
    state = {
      ...state,
      tree,
      interaction: { ...state.interaction, expandedFolderId: null },
    };
    emit();
  },
  selectEntity(id: string | null): void {
    if (state.interaction.selectedId === id) return;
    let { focusMode, anchorId } = state.interaction;
    if (id === null) {
      // Clearing selection ends focus — an empty canvas with no
      // anchor would look broken; roll back to overview cleanly.
      focusMode = "none";
      anchorId = null;
    } else if (state.interaction.selectedId === null && focusMode === "none") {
      // Auto-focus on the FIRST selection out of an overview — turns
      // "I clicked a file" into "show me this file and what it
      // touches" without a second gesture. If the user explicitly
      // exited focus earlier (Esc clears + Show overview), selecting
      // another entity keeps them in overview; the focus flag only
      // flips on this clean empty→selection transition.
      focusMode = "neighborhood";
      anchorId = id;
    }
    // Otherwise preserve the anchor + mode — canvas clicks that move
    // the selection inside an active focus scope must NOT reshape
    // the visible set, or the user would see the canvas collapse
    // under their cursor every time they inspected a neighbour.
    state = {
      ...state,
      interaction: { ...state.interaction, selectedId: id, focusMode, anchorId },
    };
    emit();
  },
  hoverEntity(id: string | null): void {
    if (state.interaction.hoveredId === id) return;
    let hoveredAncestorIds: ReadonlySet<string> = EMPTY_SET;
    if (id !== null && state.tree !== null) {
      const ancestors = new Set<string>();
      let cur = state.tree.byId.get(id);
      while (cur?.parentId !== null && cur?.parentId !== undefined) {
        ancestors.add(cur.parentId);
        cur = state.tree.byId.get(cur.parentId);
      }
      hoveredAncestorIds = ancestors;
    }
    state = { ...state, interaction: { ...state.interaction, hoveredId: id, hoveredAncestorIds } };
    emit();
  },
  setFocusMode(mode: "none" | "neighborhood"): void {
    if (state.interaction.focusMode === mode) return;
    let { anchorId } = state.interaction;
    if (mode === "none") anchorId = null;
    else if (anchorId === null) anchorId = state.interaction.selectedId;
    state = { ...state, interaction: { ...state.interaction, focusMode: mode, anchorId } };
    emit();
  },
  /** Commit a new scope anchor — called by Explorer clicks, canvas
   *  drill-in, and Inspector's drill button. Implicitly enters
   *  `neighborhood` mode and moves the selection to the anchor so
   *  Inspector opens on the same entity. Pass `null` to return to
   *  overview. */
  setAnchor(id: string | null): void {
    const cur = state.interaction;
    const nextFocus: "none" | "neighborhood" = id === null ? "none" : "neighborhood";
    const nextSel = id === null ? cur.selectedId : id;
    if (cur.anchorId === id && cur.focusMode === nextFocus && cur.selectedId === nextSel) return;
    state = {
      ...state,
      interaction: {
        ...cur,
        anchorId: id,
        focusMode: nextFocus,
        selectedId: nextSel,
      },
    };
    emit();
  },
  /** Street-tier inline folder expansion. Pass a folder id to expand
   *  its children inside its own rect (peers dim to thumbnails), or
   *  `null` to collapse. Deliberately independent of `selectedId` /
   *  `anchorId` — expanding a folder does not move the selection, and
   *  selecting a child inside the expanded folder must not collapse
   *  it. */
  locateEntity(id: string | null): void {
    if (state.interaction.locateId === id) return;
    state = { ...state, interaction: { ...state.interaction, locateId: id } };
    emit();
  },
  setExpandedFolder(id: string | null): void {
    if (state.interaction.expandedFolderId === id) return;
    state = { ...state, interaction: { ...state.interaction, expandedFolderId: id } };
    emit();
  },
  reset(): void {
    state = initial;
    emit();
  },
};

export function useEntityState<T>(selector: (s: EntityState) => T): T {
  // See the matching comment in tier/model/store.ts. Cache the selector
  // output per state identity so object-returning selectors cannot
  // trigger the useSyncExternalStore "getSnapshot should be cached"
  // infinite-loop trap.
  const cache = useRef<{ state: EntityState; value: T } | null>(null);
  return useSyncExternalStore(entityStore.subscribe, () => {
    const s = entityStore.getState();
    const c = cache.current;
    if (c && c.state === s) return c.value;
    const value = selector(s);
    cache.current = { state: s, value };
    return value;
  });
}
