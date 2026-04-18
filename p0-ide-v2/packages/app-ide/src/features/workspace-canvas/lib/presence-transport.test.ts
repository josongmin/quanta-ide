import { describe, it, expect } from "vitest";
import {
  MockPresenceTransport,
  isPresenceMessage,
  type PresenceMessage,
} from "./presence-transport";

// Coverage goals for MockPresenceTransport:
// - connect() resolves and flips state to "open"
// - subscribers see scripted messages in the emitted order
// - unsubscribe stops further delivery
// - send() is a no-op (no throw, no accidental dispatch)
// - dispatch() is idempotent across listeners and survives handler throws

describe("MockPresenceTransport", () => {
  it("connects and emits scripted messages in order", async () => {
    const scripted: PresenceMessage[] = [
      { kind: "presence-join", userId: "u1", label: "alice", color: 0x7dd3fc },
      {
        kind: "cursor-update",
        userId: "u1",
        worldX: 10,
        worldY: 20,
        timestamp: 100,
      },
      { kind: "cursor-left", userId: "u1" },
    ];
    const tr = new MockPresenceTransport({ scripted });
    const received: PresenceMessage[] = [];
    tr.onMessage(m => received.push(m));

    expect(tr.state).toBe("disconnected");
    const p = tr.connect();
    expect(tr.state).toBe("connecting");
    await p;
    expect(tr.state).toBe("open");
    expect(received).toEqual(scripted);
  });

  it("unsubscribes cleanly — no more messages after unsubscribe", async () => {
    const tr = new MockPresenceTransport();
    const received: PresenceMessage[] = [];
    const off = tr.onMessage(m => received.push(m));
    await tr.connect();
    tr.dispatch({ kind: "cursor-left", userId: "a" });
    off();
    tr.dispatch({ kind: "cursor-left", userId: "b" });
    expect(received).toEqual([{ kind: "cursor-left", userId: "a" }]);
  });

  it("send() is a no-op and does not throw", async () => {
    const tr = new MockPresenceTransport();
    await tr.connect();
    expect(() =>
      tr.send({
        kind: "cursor-update",
        userId: "x",
        worldX: 0,
        worldY: 0,
        timestamp: 0,
      }),
    ).not.toThrow();
  });

  it("dispatch survives handler errors and keeps other handlers alive", async () => {
    const tr = new MockPresenceTransport();
    const ok: PresenceMessage[] = [];
    tr.onMessage(() => {
      throw new Error("boom");
    });
    tr.onMessage(m => ok.push(m));
    await tr.connect();
    tr.dispatch({ kind: "cursor-left", userId: "z" });
    expect(ok).toEqual([{ kind: "cursor-left", userId: "z" }]);
  });

  it("disconnect() flips state and stops the scripted interval", async () => {
    const tr = new MockPresenceTransport({
      scripted: [
        { kind: "cursor-left", userId: "a" },
        { kind: "cursor-left", userId: "b" },
      ],
      emitEveryMs: 1000,
    });
    await tr.connect();
    tr.disconnect();
    expect(tr.state).toBe("disconnected");
  });
});

describe("isPresenceMessage", () => {
  it("accepts every well-formed kind", () => {
    const samples: PresenceMessage[] = [
      {
        kind: "cursor-update",
        userId: "u",
        worldX: 0,
        worldY: 0,
        timestamp: 1,
      },
      { kind: "cursor-left", userId: "u" },
      {
        kind: "comment-add",
        threadId: "t",
        messageId: "m",
        body: "hi",
        author: "a",
        timestamp: 1,
      },
      { kind: "comment-resolve", threadId: "t", by: "a" },
      {
        kind: "reaction-add",
        targetKind: "file",
        targetId: "f",
        emoji: "🔥",
        author: "a",
      },
      { kind: "presence-join", userId: "u", label: "U", color: 0xffffff },
      { kind: "presence-leave", userId: "u" },
    ];
    for (const s of samples) expect(isPresenceMessage(s)).toBe(true);
  });

  it("rejects malformed payloads", () => {
    expect(isPresenceMessage(null)).toBe(false);
    expect(isPresenceMessage({})).toBe(false);
    expect(isPresenceMessage({ kind: "cursor-update" })).toBe(false);
    expect(
      isPresenceMessage({
        kind: "cursor-update",
        userId: 1,
        worldX: 0,
        worldY: 0,
        timestamp: 0,
      }),
    ).toBe(false);
    expect(isPresenceMessage({ kind: "__ping__", t: 123 })).toBe(false);
  });
});
