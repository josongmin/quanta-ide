// ---------------------------------------------------------------------------
// Toast contract types
// Minimal subset of `src/shared/model/toast-store/toast-store.ts`.
// ---------------------------------------------------------------------------

export type ToastKind = "info" | "success" | "warn" | "danger";

export interface ToastOptions {
  /** Override the auto-dismiss duration (ms). Pass 0 to persist. */
  ttlMs?: number;
  /** Secondary line of text. */
  detail?: string;
  /** Engine signal tag, e.g. "taint-flow". */
  engine?: string;
}
