// PresenceTransport — wire-format for realtime collaboration (cursors,
// comments, reactions, presence join/leave).
//
// The transport is the *only* coupling point between the in-memory
// collab stores and the network layer. Both the mock drivers and a
// real WebSocket client implement `PresenceTransport`, so swapping
// them is a single `setPresenceTransport()` call — no store code
// changes, no React re-renders, no ceremony.
//
// Design notes
// - `PresenceMessage` is a discriminated union; every incoming payload
//   runs through `isPresenceMessage` before being dispatched.
// - `send()` is fire-and-forget. Transports may buffer while
//   `state !== "open"` and flush on connect.
// - `onMessage(handler)` returns an unsubscribe; stores subscribe
//   once at module load and translate messages into store mutations.
// - `readonly state` is snapshot-in-time; transports should emit a
//   "presence-join"/"presence-leave" when state flips so consumers
//   can render a "reconnecting…" hint without polling.

export type PresenceTransportState =
  | "disconnected"
  | "connecting"
  | "open"
  | "closing"
  | "error";

export type PresenceMessage =
  | {
      kind: "cursor-update";
      userId: string;
      worldX: number;
      worldY: number;
      timestamp: number;
    }
  | { kind: "cursor-left"; userId: string }
  | {
      kind: "comment-add";
      threadId: string;
      messageId: string;
      body: string;
      author: string;
      timestamp: number;
    }
  | { kind: "comment-resolve"; threadId: string; by: string }
  | {
      kind: "reaction-add";
      targetKind: string;
      targetId: string;
      emoji: string;
      author: string;
    }
  | { kind: "presence-join"; userId: string; label: string; color: number }
  | { kind: "presence-leave"; userId: string };

export type PresenceMessageHandler = (msg: PresenceMessage) => void;

export interface PresenceTransport {
  connect(): Promise<void>;
  disconnect(): void;
  send(msg: PresenceMessage): void;
  onMessage(handler: PresenceMessageHandler): () => void;
  readonly state: PresenceTransportState;
  readonly id: string;
}

// ── Type guards ──────────────────────────────────────────────────────
//
// Defensive parsing for incoming wire traffic. We only forward messages
// that match one of the union members; anything else is ignored and
// logged. Explicit checks (rather than a Zod schema) keep the runtime
// footprint near zero for a message type we emit dozens of times per
// second.

function isString(v: unknown): v is string {
  return typeof v === "string";
}
function isNumber(v: unknown): v is number {
  return typeof v === "number" && Number.isFinite(v);
}

export function isPresenceMessage(v: unknown): v is PresenceMessage {
  if (!v || typeof v !== "object") return false;
  const m = v as { kind?: unknown };
  if (!isString(m.kind)) return false;
  switch (m.kind) {
    case "cursor-update": {
      const x = v as PresenceMessage & { kind: "cursor-update" };
      return (
        isString(x.userId) &&
        isNumber(x.worldX) &&
        isNumber(x.worldY) &&
        isNumber(x.timestamp)
      );
    }
    case "cursor-left": {
      const x = v as PresenceMessage & { kind: "cursor-left" };
      return isString(x.userId);
    }
    case "comment-add": {
      const x = v as PresenceMessage & { kind: "comment-add" };
      return (
        isString(x.threadId) &&
        isString(x.messageId) &&
        isString(x.body) &&
        isString(x.author) &&
        isNumber(x.timestamp)
      );
    }
    case "comment-resolve": {
      const x = v as PresenceMessage & { kind: "comment-resolve" };
      return isString(x.threadId) && isString(x.by);
    }
    case "reaction-add": {
      const x = v as PresenceMessage & { kind: "reaction-add" };
      return (
        isString(x.targetKind) &&
        isString(x.targetId) &&
        isString(x.emoji) &&
        isString(x.author)
      );
    }
    case "presence-join": {
      const x = v as PresenceMessage & { kind: "presence-join" };
      return isString(x.userId) && isString(x.label) && isNumber(x.color);
    }
    case "presence-leave": {
      const x = v as PresenceMessage & { kind: "presence-leave" };
      return isString(x.userId);
    }
    default:
      return false;
  }
}

// ── MockPresenceTransport ───────────────────────────────────────────
//
// Connects "immediately" (resolve on next microtask), ignores outbound
// sends, and emits scripted messages on a schedule. Good enough for
// demos / tests and keeps the store-wiring identical to the real
// transport.

export interface MockPresenceTransportOptions {
  /** Scripted messages to emit once connected. */
  scripted?: readonly PresenceMessage[];
  /** Delay between scripted emits (ms). Default 0 (all at once). */
  emitEveryMs?: number;
}

export class MockPresenceTransport implements PresenceTransport {
  readonly id: string;
  private _state: PresenceTransportState = "disconnected";
  private handlers = new Set<PresenceMessageHandler>();
  private intervalId: ReturnType<typeof setInterval> | null = null;
  private scriptPos = 0;
  private readonly scripted: readonly PresenceMessage[];
  private readonly emitEveryMs: number;

  constructor(opts: MockPresenceTransportOptions = {}) {
    this.id = `mock-${Math.random().toString(36).slice(2, 8)}`;
    this.scripted = opts.scripted ?? [];
    this.emitEveryMs = Math.max(0, opts.emitEveryMs ?? 0);
  }

  get state(): PresenceTransportState {
    return this._state;
  }

  async connect(): Promise<void> {
    this._state = "connecting";
    // Resolve on the next microtask so the "connecting" state is observable.
    await Promise.resolve();
    this._state = "open";
    if (this.scripted.length === 0) return;
    if (this.emitEveryMs === 0) {
      for (const msg of this.scripted) this.dispatch(msg);
      return;
    }
    this.intervalId = setInterval(() => {
      if (this.scriptPos >= this.scripted.length) {
        if (this.intervalId) clearInterval(this.intervalId);
        this.intervalId = null;
        return;
      }
      this.dispatch(this.scripted[this.scriptPos]!);
      this.scriptPos += 1;
    }, this.emitEveryMs);
  }

  disconnect(): void {
    this._state = "closing";
    if (this.intervalId) {
      clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this._state = "disconnected";
  }

  send(_msg: PresenceMessage): void {
    // no-op: the mock has no "server" to relay through.
  }

  onMessage(handler: PresenceMessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  /** Emit a message to every subscriber. Exposed for the mock drivers. */
  dispatch(msg: PresenceMessage): void {
    for (const h of [...this.handlers]) {
      try {
        h(msg);
      } catch (err) {
        console.warn("[MockPresenceTransport] handler threw", err);
      }
    }
  }
}

// ── WebSocketPresenceTransport ──────────────────────────────────────
//
// Real WebSocket client. Exponential reconnect (500ms → 30s cap) so a
// dropped connection doesn't storm the server on recovery. A 20s
// heartbeat keeps intermediaries from garbage-collecting idle sockets.
//
// Messages are JSON-encoded; parsing failures log a warning but don't
// kill the socket — a single malformed broadcast shouldn't take down
// the whole session.

export interface WebSocketPresenceTransportOptions {
  reconnectBackoffMs?: number;
  heartbeatMs?: number;
  /** Injection point for tests — defaults to the global WebSocket. */
  webSocketImpl?: typeof WebSocket;
}

const DEFAULT_BACKOFF_MS = 500;
const MAX_BACKOFF_MS = 30_000;
const DEFAULT_HEARTBEAT_MS = 20_000;

export class WebSocketPresenceTransport implements PresenceTransport {
  readonly id: string;
  private _state: PresenceTransportState = "disconnected";
  private handlers = new Set<PresenceMessageHandler>();
  private ws: WebSocket | null = null;
  private readonly url: string;
  private readonly baseBackoffMs: number;
  private readonly heartbeatMs: number;
  private readonly WSCtor: typeof WebSocket;
  private currentBackoffMs: number;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private heartbeatTimer: ReturnType<typeof setInterval> | null = null;
  private outbox: PresenceMessage[] = [];
  private closedByUser = false;

  constructor(url: string, opts: WebSocketPresenceTransportOptions = {}) {
    this.id = `ws-${Math.random().toString(36).slice(2, 8)}`;
    this.url = url;
    this.baseBackoffMs = opts.reconnectBackoffMs ?? DEFAULT_BACKOFF_MS;
    this.currentBackoffMs = this.baseBackoffMs;
    this.heartbeatMs = opts.heartbeatMs ?? DEFAULT_HEARTBEAT_MS;
    // Explicit fallback to globalThis.WebSocket so tests can inject a mock.
    const wsImpl =
      opts.webSocketImpl ??
      (typeof WebSocket !== "undefined" ? WebSocket : undefined);
    if (!wsImpl) {
      throw new Error(
        "WebSocketPresenceTransport: no WebSocket implementation available in this environment",
      );
    }
    this.WSCtor = wsImpl;
  }

  get state(): PresenceTransportState {
    return this._state;
  }

  async connect(): Promise<void> {
    this.closedByUser = false;
    await this.openSocket();
  }

  disconnect(): void {
    this.closedByUser = true;
    this._state = "closing";
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
    this.stopHeartbeat();
    if (this.ws) {
      try {
        this.ws.close();
      } catch {
        // socket already torn down — nothing to do.
      }
      this.ws = null;
    }
    this._state = "disconnected";
  }

  send(msg: PresenceMessage): void {
    if (this._state !== "open" || !this.ws) {
      this.outbox.push(msg);
      return;
    }
    try {
      this.ws.send(JSON.stringify(msg));
    } catch (err) {
      console.warn("[WebSocketPresenceTransport] send failed", err);
      this.outbox.push(msg);
    }
  }

  onMessage(handler: PresenceMessageHandler): () => void {
    this.handlers.add(handler);
    return () => {
      this.handlers.delete(handler);
    };
  }

  private async openSocket(): Promise<void> {
    this._state = "connecting";
    let ws: WebSocket;
    try {
      ws = new this.WSCtor(this.url);
    } catch (err) {
      console.warn("[WebSocketPresenceTransport] ctor threw", err);
      this._state = "error";
      this.scheduleReconnect();
      return;
    }
    this.ws = ws;
    ws.onopen = () => {
      this._state = "open";
      this.currentBackoffMs = this.baseBackoffMs;
      this.startHeartbeat();
      // Flush anything queued while we were offline.
      const flush = this.outbox;
      this.outbox = [];
      for (const msg of flush) this.send(msg);
    };
    ws.onmessage = ev => {
      let parsed: unknown;
      try {
        parsed = JSON.parse(typeof ev.data === "string" ? ev.data : "");
      } catch {
        console.warn("[WebSocketPresenceTransport] invalid JSON");
        return;
      }
      if (!isPresenceMessage(parsed)) {
        console.warn("[WebSocketPresenceTransport] unknown message", parsed);
        return;
      }
      for (const h of [...this.handlers]) {
        try {
          h(parsed);
        } catch (err) {
          console.warn("[WebSocketPresenceTransport] handler threw", err);
        }
      }
    };
    ws.onerror = () => {
      this._state = "error";
    };
    ws.onclose = () => {
      this.stopHeartbeat();
      this.ws = null;
      if (this.closedByUser) {
        this._state = "disconnected";
        return;
      }
      this.scheduleReconnect();
    };
  }

  private scheduleReconnect(): void {
    if (this.reconnectTimer) return;
    const delay = Math.min(this.currentBackoffMs, MAX_BACKOFF_MS);
    this.reconnectTimer = setTimeout(() => {
      this.reconnectTimer = null;
      void this.openSocket();
    }, delay);
    // Exponential; capped at MAX_BACKOFF_MS.
    this.currentBackoffMs = Math.min(this.currentBackoffMs * 2, MAX_BACKOFF_MS);
  }

  private startHeartbeat(): void {
    this.stopHeartbeat();
    this.heartbeatTimer = setInterval(() => {
      if (!this.ws || this._state !== "open") return;
      // Use the "presence-join" channel with a throwaway userId as a
      // cheap liveness ping — server-side routers can filter these.
      // Real deployments can flip to a dedicated `{kind:"ping"}` once
      // the backend schema accepts it.
      try {
        this.ws.send(JSON.stringify({ kind: "__ping__", t: Date.now() }));
      } catch {
        // swallow; the onclose handler will reconnect if needed.
      }
    }, this.heartbeatMs);
  }

  private stopHeartbeat(): void {
    if (this.heartbeatTimer) {
      clearInterval(this.heartbeatTimer);
      this.heartbeatTimer = null;
    }
  }
}
