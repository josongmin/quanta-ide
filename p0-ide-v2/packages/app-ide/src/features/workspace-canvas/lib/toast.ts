import { toast as shellToast, toastStore } from "@quanta/shell/stores/toast-store";

// Thin wrapper around the shell's toast-store for workspace-canvas
// code that just wants a one-liner "show this string for a second".
//
// Inline "flash" / "setTimeout" toasts scattered across
// ExportButton / InspectorPanel / etc. are migrated to `showToast`;
// the existing `toast.success/info/warn/danger` helpers remain the
// preferred path for structured engine toasts (they carry a `detail`
// and `engine` badge).

/**
 * Show a one-line toast and auto-dismiss after `durationMs` (default 1500).
 * Returns the toast id so callers can dismiss early if needed.
 */
export function showToast(msg: string, durationMs = 1500): string {
  return toastStore.push({
    kind: "info",
    title: msg,
    ttlMs: Math.max(100, durationMs),
  });
}

/**
 * Success variant — same signature, green/positive styling.
 */
export function showSuccessToast(msg: string, durationMs = 1500): string {
  return toastStore.push({
    kind: "success",
    title: msg,
    ttlMs: Math.max(100, durationMs),
  });
}

/**
 * Error/danger variant for failed copies / exports / etc.
 */
export function showErrorToast(msg: string, durationMs = 2200): string {
  return toastStore.push({
    kind: "danger",
    title: msg,
    ttlMs: Math.max(100, durationMs),
  });
}

// Re-export the shell helper so call sites in this feature can keep a
// single import surface when they want the full structured toast.
export { shellToast as toast };
