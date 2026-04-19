// Generic localStorage persistence helper for workspace-canvas stores.
// -------------------------------------------------------------------
// Generalizes the `readPersisted` / `writePersisted` pattern used by
// `annotations-store` so other stores (bookmarks, theme, images) can
// share the same defensive validation / legacy-migration / swallow-errors
// contract without hand-rolling it each time.
//
// Design notes:
//   * `validate` is the narrow point — callers return `null` for shapes
//     they don't recognize; the helper falls back to the supplied default.
//   * Errors (JSON.parse, quota, private-mode writes) are swallowed. The
//     store keeps the in-memory copy; persistence is best-effort.
//   * `legacyKey` is removed once on first successful `load()` so old
//     data doesn't shadow a new schema after a migration.

export interface PersistenceAdapter<State> {
  /** Read persisted state from storage; fall back to `fallback` if absent/invalid. */
  load(fallback: State): State;
  /** Serialize and write the persistable slice of `state`. Errors swallowed. */
  save(state: State): void;
  /** Optional — remove the legacy key explicitly (also invoked from `load()`). */
  clearLegacyKey?(): void;
}

export interface PersistenceOptions<State, Persisted> {
  /** localStorage key. */
  key: string;
  /** Schema version — wiring reserved for future migrations. */
  version: number;
  /** Narrow raw parsed JSON to the persisted slice. Return `null` to reject. */
  validate: (raw: unknown) => Persisted | null;
  /** Project full state → persisted slice (omit ephemeral fields). */
  toPersisted: (state: State) => Persisted;
  /** Reconstruct full state from validated persisted slice + defaults. */
  fromPersisted: (persisted: Persisted, defaults: State) => State;
  /** Optional legacy key to delete on load (migration). */
  legacyKey?: string;
}

function hasLocalStorage(): boolean {
  return typeof localStorage !== "undefined";
}

function tryRemove(key: string): void {
  try {
    if (!hasLocalStorage()) return;
    localStorage.removeItem(key);
  } catch {
    // best-effort
  }
}

export function createPersistence<State, Persisted>(
  opts: PersistenceOptions<State, Persisted>,
): PersistenceAdapter<State> {
  const { key, validate, toPersisted, fromPersisted, legacyKey } = opts;

  const clearLegacyKey = legacyKey
    ? () => tryRemove(legacyKey)
    : undefined;

  return {
    load(fallback: State): State {
      // Best-effort legacy key cleanup happens before reading the current
      // key so a stray migration ghost can never satisfy a read miss.
      if (clearLegacyKey) clearLegacyKey();
      try {
        if (!hasLocalStorage()) return fallback;
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        const parsed: unknown = JSON.parse(raw);
        const narrowed = validate(parsed);
        if (narrowed === null) return fallback;
        return fromPersisted(narrowed, fallback);
      } catch {
        return fallback;
      }
    },
    save(state: State): void {
      try {
        if (!hasLocalStorage()) return;
        localStorage.setItem(key, JSON.stringify(toPersisted(state)));
      } catch {
        // Quota / private mode / serialization — best effort.
      }
    },
    ...(clearLegacyKey ? { clearLegacyKey } : {}),
  };
}
