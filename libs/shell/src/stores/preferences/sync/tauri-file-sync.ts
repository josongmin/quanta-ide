import { preferences } from "../preferences-store";
import { migrate } from "../migrations";
import type { Preferences } from "../schema";
import type { PreferencesSyncAdapter } from "./sync-adapter";

/**
 * Tauri file-backed sidecar.
 *
 * Reads/writes preferences.json in the OS app-config dir through two
 * Tauri commands that the desktop crate must register:
 *
 *   • `preferences_read`  → Result<String, String>    (file contents or "")
 *   • `preferences_write` → fn(contents: String) -> Result<(), String>
 *
 * These commands intentionally live behind `invoke()` (not a plugin) so the
 * web bundle stays free of Tauri code; this module is only imported when
 * `__TAURI_INTERNALS__` is present on `window`.
 *
 * TODO(desktop): register the commands in
 *   desktop/src-tauri/src/adapter/tauri_cmd/preferences.rs
 * and wire them into the composition root in `lib.rs::run()`. Until then
 * invoke() rejects and the adapter falls back to localStorage-only.
 */

const WRITE_DEBOUNCE_MS = 200;
const CMD_READ = "preferences_read";
const CMD_WRITE = "preferences_write";

export async function createTauriFileSync(): Promise<PreferencesSyncAdapter | null> {
  let invoke: typeof import("@tauri-apps/api/core").invoke;
  try {
    ({ invoke } = await import("@tauri-apps/api/core"));
  } catch {
    return null;
  }

  let writeTimer: ReturnType<typeof setTimeout> | null = null;
  let pending: Preferences | null = null;
  let disposed = false;

  const flush = async () => {
    writeTimer = null;
    if (!pending || disposed) return;
    const snapshot = pending;
    pending = null;
    try {
      await invoke(CMD_WRITE, { contents: JSON.stringify(snapshot) });
    } catch {
      // Rust command not registered yet (Phase 2) or fs error —
      // localStorage already holds the value, so we silently skip.
    }
  };

  const schedule = (next: Preferences) => {
    pending = next;
    if (writeTimer) return;
    writeTimer = setTimeout(() => { void flush(); }, WRITE_DEBOUNCE_MS);
  };

  const unsubscribe = preferences.subscribeExternal(schedule);

  return {
    name: "tauri-file",
    load: async () => {
      try {
        const raw = await invoke<string>(CMD_READ);
        if (!raw) return null;
        return migrate(JSON.parse(raw) as unknown);
      } catch {
        return null;
      }
    },
    write: async (next) => {
      pending = next;
      if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
      await flush();
    },
    dispose: () => {
      disposed = true;
      unsubscribe();
      if (writeTimer) { clearTimeout(writeTimer); writeTimer = null; }
    },
  };
}
