export type ToastKind = "info" | "success" | "warn" | "danger";
export interface Toast {
    id: string;
    kind: ToastKind;
    title: string;
    detail?: string;
    engine?: string;
    ttlMs?: number;
    /** @internal Set by the store when the toast is animating out. */
    leaving?: boolean;
}
export interface ToastOptions {
    /** Override the auto-dismiss duration (ms). Pass 0 to persist. */
    ttlMs?: number;
    /** Secondary line of text. */
    detail?: string;
    /** Engine signal tag, e.g. "taint-flow". */
    engine?: string;
}
