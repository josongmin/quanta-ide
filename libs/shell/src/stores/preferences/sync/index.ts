import { preferences } from "../preferences-store";
import type { PreferencesSyncAdapter } from "./sync-adapter";

/**
 * Attach an external persistence layer on top of the localStorage-backed
 * core. Today: Tauri filesystem sidecar when running under a Tauri webview.
 * On the browser this is a no-op — localStorage is the whole story.
 *
 * Contract: "file wins on boot". If the disk snapshot exists, the store is
 * hydrated from it before the first React render commits anything further.
 * After boot, writes flow local → disk (debounced).
 *
 * Returns a dispose function. Safe to call multiple times (idempotent
 * via the `disposed` guard in the returned closure).
 */
export async function attachPreferencesSync(): Promise<() => void> {
  const adapter = await pickAdapter();
  if (!adapter) return () => { /* no-op */ };

  try {
    const snapshot = await adapter.load();
    if (snapshot) preferences.hydrate(snapshot);
  } catch {
    // Fall through — localStorage remains authoritative.
  }

  let disposed = false;
  return () => {
    if (disposed) return;
    disposed = true;
    adapter.dispose();
  };
}

async function pickAdapter(): Promise<PreferencesSyncAdapter | null> {
  if (typeof window === "undefined") return null;
  if (!("__TAURI_INTERNALS__" in window)) return null;

  const { createTauriFileSync } = await import("./tauri-file-sync");
  return createTauriFileSync();
}
