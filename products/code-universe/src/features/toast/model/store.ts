import { useSyncExternalStore } from "react";

// Toast store
// --------------------------------------------------------------------
// Tiny queue of short-lived notifications. Modelled after the "passive
// confirmation" pattern in Material / iOS: a brief, non-modal strip
// that fades in, dwells ~3s, fades out. Each toast carries a kind
// (info / success / warn / error) that controls accent colour and an
// optional action (click target that dismisses + fires a callback).
//
// Auto-dismiss uses a single RAF timer per toast — no global ticker.
// Calling `push()` while a toast is already showing stacks a second
// one under it (older at the bottom) so rapid-fire actions still
// surface cleanly without overwriting.

export type ToastKind = "info" | "success" | "warn" | "error";

export interface Toast {
  id: string;
  kind: ToastKind;
  message: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  createdAt: number;
  /** ms after createdAt when the toast auto-dismisses. */
  ttl: number;
}

interface State {
  toasts: readonly Toast[];
}

let state: State = { toasts: [] };
let idCounter = 0;
const listeners = new Set<() => void>();
function emit(): void {
  for (const l of [...listeners]) l();
}

const DEFAULT_TTL: Record<ToastKind, number> = {
  info: 3000,
  success: 3000,
  warn: 4500,
  error: 6000, // errors deserve extra dwell so users can read + react
};

export interface PushToastInput {
  kind?: ToastKind;
  message: string;
  action?: Toast["action"];
  /** ms override — default varies by kind. */
  ttl?: number;
}

export const toastStore = {
  getState(): State {
    return state;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  push(input: PushToastInput): string {
    const id = `toast-${idCounter++}`;
    const kind = input.kind ?? "info";
    const toast: Toast = {
      id,
      kind,
      message: input.message,
      createdAt: Date.now(),
      ttl: input.ttl ?? DEFAULT_TTL[kind],
      ...(input.action ? { action: input.action } : {}),
    };
    state = { toasts: [...state.toasts, toast] };
    emit();
    // Fire-and-forget auto-dismiss. We schedule via setTimeout rather
    // than RAF because the dwell is measured in seconds — RAF would
    // wake the main thread 60× per second for no reason.
    setTimeout(() => toastStore.dismiss(id), toast.ttl);
    return id;
  },
  dismiss(id: string): void {
    if (!state.toasts.some(t => t.id === id)) return;
    state = { toasts: state.toasts.filter(t => t.id !== id) };
    emit();
  },
  clear(): void {
    if (state.toasts.length === 0) return;
    state = { toasts: [] };
    emit();
  },
};

export function useToasts<T>(selector: (s: State) => T): T {
  return useSyncExternalStore(
    toastStore.subscribe,
    () => selector(toastStore.getState()),
    () => selector(toastStore.getState()),
  );
}

/**
 * Convenience helpers so call-sites read like prose. `toast.success("…")`
 * is immediately legible, whereas `toastStore.push({ kind: "success", … })`
 * forces a mental pattern-match on every invocation.
 */
export const toast = {
  info(message: string, opts?: Omit<PushToastInput, "kind" | "message">): string {
    return toastStore.push({ ...opts, kind: "info", message });
  },
  success(message: string, opts?: Omit<PushToastInput, "kind" | "message">): string {
    return toastStore.push({ ...opts, kind: "success", message });
  },
  warn(message: string, opts?: Omit<PushToastInput, "kind" | "message">): string {
    return toastStore.push({ ...opts, kind: "warn", message });
  },
  error(message: string, opts?: Omit<PushToastInput, "kind" | "message">): string {
    return toastStore.push({ ...opts, kind: "error", message });
  },
};
