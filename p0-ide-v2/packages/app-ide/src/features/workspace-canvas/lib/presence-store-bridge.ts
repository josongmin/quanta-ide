import { cursorsStore } from "../store/cursors-store";
import { commentsStore } from "../store/comments-store";
import { reactionsStore } from "../store/reactions-store";
import { presenceStore } from "../store/presence-store";
import type { PresenceMessage, PresenceTransport } from "./presence-transport";
import {
  getPresenceTransport,
  onPresenceTransportSwap,
} from "./presence-transport-ref";

// presence-store-bridge — translates PresenceMessages from the active
// transport into store mutations. This is the only place stores and
// transport touch each other, so swapping mock→WebSocket (or vice
// versa) is a pure transport swap: every mutation path below keeps
// working unchanged.
//
// Lifecycle
// - `installPresenceBridge()` is idempotent: call it once at app boot.
//   It subscribes to the current transport and also listens for swap
//   events so later `setPresenceTransport()` calls automatically
//   rebind the listener.
// - Returns an unsubscribe fn for tests.

function paletteForUser(userId: string, fallback = 0x7dd3fc): string {
  // Deterministic pick — same userId always gets the same CSS hue.
  // var(--ws-user-a/b) etc. already cover most named walkers; hash
  // foreign ids into a small palette so multi-user sessions avoid
  // white-on-white cursors.
  const named: Record<string, string> = {
    "viewer-a": "var(--ws-user-a)",
    "viewer-b": "var(--ws-user-b)",
  };
  if (named[userId]) return named[userId];
  let h = 0;
  for (let i = 0; i < userId.length; i++) {
    h = (h * 31 + userId.charCodeAt(i)) | 0;
  }
  const hex = (fallback >>> 0).toString(16).padStart(6, "0");
  // Blend the fallback with a hue jitter so each userId has its own tint.
  const shift = Math.abs(h) % 60;
  return `hsl(${shift * 6} 80% 70%)#${hex.slice(-6)}`.replace(/#[0-9a-f]+$/i, "");
}

function dispatch(msg: PresenceMessage): void {
  switch (msg.kind) {
    case "presence-join": {
      // Pre-seed the cursor entry so label/color are known before any
      // cursor-update arrives.
      cursorsStore.setCursor(msg.userId, {
        label: msg.label,
        color: paletteForUser(msg.userId, msg.color),
      });
      return;
    }
    case "presence-leave": {
      cursorsStore.removeCursor(msg.userId);
      return;
    }
    case "cursor-update": {
      cursorsStore.setCursor(msg.userId, {
        worldX: msg.worldX,
        worldY: msg.worldY,
        updatedAt: msg.timestamp,
      });
      return;
    }
    case "cursor-left": {
      cursorsStore.removeCursor(msg.userId);
      return;
    }
    case "comment-add": {
      // Append to the thread if it exists — otherwise silently ignore:
      // the thread should be seeded via its own RPC first. A real
      // backend would include the thread metadata on first add; the
      // local mock never emits this path today.
      commentsStore.addMessage(msg.threadId, msg.body, msg.author);
      return;
    }
    case "comment-resolve": {
      commentsStore.toggleResolved(msg.threadId);
      return;
    }
    case "reaction-add": {
      const kind = msg.targetKind;
      // Narrow the wire string to the store's union; drop unknown kinds
      // defensively rather than coercing.
      if (
        kind === "file" ||
        kind === "edge" ||
        kind === "sticky" ||
        kind === "comment"
      ) {
        reactionsStore.react({ kind, id: msg.targetId }, msg.emoji, msg.author);
      }
      return;
    }
  }
}

let installed = false;
let unsubscribeCurrent: (() => void) | null = null;
let unsubscribeSwap: (() => void) | null = null;

function rebind(tr: PresenceTransport): void {
  if (unsubscribeCurrent) {
    unsubscribeCurrent();
    unsubscribeCurrent = null;
  }
  unsubscribeCurrent = tr.onMessage(dispatch);
}

export function installPresenceBridge(): () => void {
  if (installed) {
    return uninstallPresenceBridge;
  }
  installed = true;
  rebind(getPresenceTransport());
  unsubscribeSwap = onPresenceTransportSwap(rebind);
  return uninstallPresenceBridge;
}

export function uninstallPresenceBridge(): void {
  installed = false;
  if (unsubscribeCurrent) {
    unsubscribeCurrent();
    unsubscribeCurrent = null;
  }
  if (unsubscribeSwap) {
    unsubscribeSwap();
    unsubscribeSwap = null;
  }
}

// Silence the unused-symbol warning for `presenceStore`; future bridge
// additions (agent activity over the wire) will use it. Keeping the
// import keeps the coupling-graph honest.
void presenceStore;
