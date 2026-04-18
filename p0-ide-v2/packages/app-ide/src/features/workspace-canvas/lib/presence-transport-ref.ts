import type { PresenceTransport } from "./presence-transport";
import { MockPresenceTransport } from "./presence-transport";

// Single mutable reference to the active PresenceTransport. A mock is
// installed at module load so every collab store works out of the box;
// real deployments call `setPresenceTransport(new WebSocketPresenceTransport(url))`
// at boot and the switch is transparent to every subscriber.
//
// Store wiring (cursors-store / comments-store / reactions-store /
// presence-store) subscribes lazily via `getPresenceTransport()` at
// import-time, so a swap done *before* the store modules are loaded
// (i.e. during app bootstrap) is the common path; swapping after that
// requires the swap-helper below to rebind subscriptions.

let transport: PresenceTransport = new MockPresenceTransport();

/** Observer list — notified when the active transport is replaced. */
const swapListeners = new Set<(next: PresenceTransport) => void>();

export function getPresenceTransport(): PresenceTransport {
  return transport;
}

export function setPresenceTransport(next: PresenceTransport): void {
  const prev = transport;
  transport = next;
  for (const l of [...swapListeners]) {
    try {
      l(next);
    } catch (err) {
      console.warn("[presence-transport-ref] swap listener threw", err);
    }
  }
  // Best-effort cleanup of the previous transport so a hot-swap doesn't
  // leak sockets. Tests can opt out by not wiring `connect()`.
  if (prev !== next) {
    try {
      prev.disconnect();
    } catch {
      // best-effort — the previous transport may already be dead.
    }
  }
}

/**
 * Subscribe to transport swaps. The callback fires synchronously with
 * the next transport whenever `setPresenceTransport` is invoked.
 * Returns an unsubscribe fn.
 */
export function onPresenceTransportSwap(
  listener: (next: PresenceTransport) => void,
): () => void {
  swapListeners.add(listener);
  return () => {
    swapListeners.delete(listener);
  };
}
