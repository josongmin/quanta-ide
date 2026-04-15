import { useSyncExternalStore } from "react";

export type ToastKind = "info" | "success" | "warn" | "danger";

export interface Toast {
  id: string;
  kind: ToastKind;
  title: string;
  detail?: string;
  engine?: string;
  ttlMs?: number;
}

interface ToastState {
  toasts: Toast[];
}

let state: ToastState = { toasts: [] };
const listeners = new Set<() => void>();
const timers = new Map<string, number>();

function emit() {
  for (const l of listeners) l();
}

function nextId(): string {
  return `t-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;
}

export const toastStore = {
  get: (): ToastState => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  push: (t: Omit<Toast, "id"> & { id?: string }): string => {
    const id = t.id ?? nextId();
    const full: Toast = { ttlMs: 4000, ...t, id };
    state = { toasts: [...state.toasts, full] };
    emit();
    if (full.ttlMs && full.ttlMs > 0) {
      const timer = window.setTimeout(() => toastStore.dismiss(id), full.ttlMs);
      timers.set(id, timer);
    }
    return id;
  },
  dismiss: (id: string) => {
    state = { toasts: state.toasts.filter((t) => t.id !== id) };
    emit();
    const timer = timers.get(id);
    if (timer !== undefined) {
      window.clearTimeout(timer);
      timers.delete(id);
    }
  },
  clear: () => {
    state = { toasts: [] };
    emit();
    for (const [, timer] of timers) window.clearTimeout(timer);
    timers.clear();
  },
};

export function useToasts(): Toast[] {
  return useSyncExternalStore(toastStore.subscribe, () => state.toasts, () => state.toasts);
}

// Convenience wrappers with deterministic IDs for "replace if already showing"
export const toast = {
  info:    (title: string, detail?: string, engine?: string) => toastStore.push({ kind: "info",    title, detail, engine }),
  success: (title: string, detail?: string, engine?: string) => toastStore.push({ kind: "success", title, detail, engine }),
  warn:    (title: string, detail?: string, engine?: string) => toastStore.push({ kind: "warn",    title, detail, engine }),
  danger:  (title: string, detail?: string, engine?: string) => toastStore.push({ kind: "danger",  title, detail, engine }),
};
