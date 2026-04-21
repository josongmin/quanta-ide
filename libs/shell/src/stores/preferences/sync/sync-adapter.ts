import type { Preferences } from "../schema";

/**
 * A sync adapter mirrors the in-memory preferences store to some external
 * persistence (filesystem, cloud, etc.) while the localStorage-backed core
 * remains the synchronous source of truth for rendering.
 *
 * Lifecycle:
 *   1. `load()` returns the on-disk snapshot at boot (file wins).
 *   2. Adapter subscribes internally; returns a `dispose()` that unwires.
 */
export interface PreferencesSyncAdapter {
  readonly name: string;
  load(): Promise<Preferences | null>;
  write(next: Preferences): Promise<void>;
  dispose(): void;
}
