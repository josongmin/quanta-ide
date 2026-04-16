// ---------------------------------------------------------------------------
// Toast contract types
// Canonical definitions — shell and ui-kit both depend on these.
// ---------------------------------------------------------------------------

export type ToastKind = "info" | "success" | "warn" | "danger";

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  detail?: string;
  engine?: string;
  ttlMs?: number;
}

export interface ToastOptions {
  /** Override the auto-dismiss duration (ms). Pass 0 to persist. */
  ttlMs?: number;
  /** Secondary line of text. */
  detail?: string;
  /** Engine signal tag, e.g. "taint-flow". */
  engine?: string;
}
