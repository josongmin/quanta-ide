// Viewport persistence
// --------------------------------------------------------------------
// Small localStorage-backed helper that remembers the viewport state
// (camera pose + active tier + selected entity id) per Code Universe
// tab. Restored on remount so switching tabs / reloading the desktop
// shell doesn't yank the user back to the universe root.
//
// Storage is keyed by `tabId` so multiple Code Universe tabs keep
// independent state. When no `tabId` is provided (bare dev,
// Storybook), we fall back to the `"default"` slot.
//
// Format is versioned (`v` field). Future migrations bump `V_CURRENT`
// and `parse` returns null on mismatch — the caller sees "no prior
// state" and falls back to the default fit-to-content path.

const KEY_PREFIX = "cu:viewport:v1:";
const V_CURRENT = 1;

export interface PersistedViewport {
  v: number;
  /** Camera translation + scale at save time. */
  tx: number;
  ty: number;
  scale: number;
  /** Active tier's canonical `name` (LodLevel). */
  tier: string;
  /** Selected entity id, or `null` when nothing is pinned. */
  selectedId: string | null;
  /** Epoch ms; lets a future expiry pass drop ancient entries. */
  at: number;
}

function key(tabId: string | undefined): string {
  return `${KEY_PREFIX}${tabId ?? "default"}`;
}

function safeStorage(): Storage | null {
  if (typeof localStorage === "undefined") return null;
  try {
    // Feature-detect mutation — Safari private mode throws on writes.
    localStorage.setItem("__cu_probe__", "1");
    localStorage.removeItem("__cu_probe__");
    return localStorage;
  } catch {
    return null;
  }
}

export function loadViewport(tabId: string | undefined): PersistedViewport | null {
  const s = safeStorage();
  if (!s) return null;
  const raw = s.getItem(key(tabId));
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as PersistedViewport;
    if (parsed.v !== V_CURRENT) return null;
    // Minimal schema guard — JSON.parse doesn't enforce shape.
    if (
      typeof parsed.tx !== "number" ||
      typeof parsed.ty !== "number" ||
      typeof parsed.scale !== "number" ||
      typeof parsed.tier !== "string"
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function saveViewport(
  tabId: string | undefined,
  input: Omit<PersistedViewport, "v" | "at">,
): void {
  const s = safeStorage();
  if (!s) return;
  const payload: PersistedViewport = {
    v: V_CURRENT,
    at: Date.now(),
    ...input,
  };
  try {
    s.setItem(key(tabId), JSON.stringify(payload));
  } catch {
    // Quota / private-browsing failure → silently degrade. No partial
    // write possible with setItem, so nothing to roll back.
  }
}

export function clearViewport(tabId: string | undefined): void {
  const s = safeStorage();
  if (!s) return;
  try {
    s.removeItem(key(tabId));
  } catch {
    /* noop */
  }
}

/**
 * Debounce helper — used by CanvasViewport to batch rapid camera
 * changes into one localStorage write. Plain `setTimeout` with a
 * single trailing-edge handle; `cancel` is safe to call repeatedly.
 */
export function debounce<T extends (...args: never[]) => void>(
  fn: T,
  delayMs: number,
): T & { cancel(): void; flush(): void } {
  let handle: ReturnType<typeof setTimeout> | null = null;
  let lastArgs: Parameters<T> | null = null;
  const wrapped = ((...args: Parameters<T>) => {
    lastArgs = args;
    if (handle !== null) clearTimeout(handle);
    handle = setTimeout(() => {
      handle = null;
      if (lastArgs) fn(...lastArgs);
      lastArgs = null;
    }, delayMs);
  }) as T & { cancel(): void; flush(): void };
  wrapped.cancel = () => {
    if (handle !== null) clearTimeout(handle);
    handle = null;
    lastArgs = null;
  };
  wrapped.flush = () => {
    if (handle !== null) clearTimeout(handle);
    handle = null;
    if (lastArgs) fn(...lastArgs);
    lastArgs = null;
  };
  return wrapped;
}
