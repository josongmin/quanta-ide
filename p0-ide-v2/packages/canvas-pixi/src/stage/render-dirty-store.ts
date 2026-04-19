// render-dirty-store
// -------------------------------------------------------------------
// Centralised dirty-flag store for the ticker-based render loop.
// Replaces the old ~30-dep useEffect in PixiStage whose array was
// compared on every React render, triggering a full overlay-stack
// update whenever any upstream produced a new referential identity
// (even for no-op selection/filter changes).
//
// Contract
//   - Six coarse dirty bits cover every render path we care about.
//     Finer granularity could shave more frames but costs API surface;
//     the six below already map 1:1 onto the existing effect paths
//     inside PixiStage.
//   - `markDirty(k)` is O(1) and idempotent. Producers mark; the
//     ticker subscriber consumes.
//   - `consumeDirty()` returns the current flags and resets them to
//     all-false. Call once per frame — never twice per frame, or the
//     second caller sees zero work.
//   - Module-scope singleton. A PixiStage instance is assumed to be
//     the only live canvas at a time (confirmed by the existing
//     `pixiByCanvas` WeakMap cache — multiple simultaneous stages are
//     not supported). If we ever need per-stage dirty state, move the
//     state onto a class and have the stage own an instance.
//
// Initial state is all-true so the first consume after mount triggers
// a full render. Subsequent frames start from the consume reset.

export type DirtyFlagKey =
  | "layout"
  | "edges"
  | "filters"
  | "viewport"
  | "selection"
  | "overlays";

export interface DirtyFlags {
  layout: boolean;
  edges: boolean;
  filters: boolean;
  viewport: boolean;
  selection: boolean;
  overlays: boolean;
}

function freshFlags(initial: boolean): DirtyFlags {
  return {
    layout: initial,
    edges: initial,
    filters: initial,
    viewport: initial,
    selection: initial,
    overlays: initial,
  };
}

let dirty: DirtyFlags = freshFlags(true);

/** Mark a render path dirty. Cheap and idempotent. */
export function markDirty(k: DirtyFlagKey): void {
  dirty[k] = true;
}

/** Mark every path dirty — useful after context-restore or cold init. */
export function markAllDirty(): void {
  dirty = freshFlags(true);
}

/**
 * Return the current dirty flags and reset all bits to false.
 * Intended to be called exactly once per ticker frame.
 */
export function consumeDirty(): DirtyFlags {
  const out = dirty;
  dirty = freshFlags(false);
  return out;
}

/** Non-destructive peek — for tests / debug only. */
export function peekDirty(): Readonly<DirtyFlags> {
  return dirty;
}

/** True when any dirty bit is set. */
export function anyDirty(flags: DirtyFlags): boolean {
  return (
    flags.layout ||
    flags.edges ||
    flags.filters ||
    flags.viewport ||
    flags.selection ||
    flags.overlays
  );
}

/** Test-only: wipe all flags. Not exported from the package barrel. */
export function __resetDirtyForTest(initial = false): void {
  dirty = freshFlags(initial);
}
