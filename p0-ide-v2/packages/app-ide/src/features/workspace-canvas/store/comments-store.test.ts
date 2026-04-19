import { describe, it, expect, beforeEach } from "vitest";
import { commentsStore, extractMentionsPublic } from "./comments-store";

describe("comments-store", () => {
  beforeEach(() => {
    commentsStore.reset([]);
  });

  it("createThread adds a thread and opens it", () => {
    const id = commentsStore.createThread({
      targetKind: "file",
      targetId: "f1",
      posX: 10,
      posY: 20,
      author: "alice",
      firstMessage: "initial @bob",
    });
    const s = commentsStore.getState();
    expect(s.threads.length).toBe(1);
    expect(s.threads[0]!.id).toBe(id);
    expect(s.openThreadId).toBe(id);
    expect(s.threads[0]!.messages.length).toBe(1);
    expect(s.threads[0]!.messages[0]!.mentions).toEqual(["bob"]);
  });

  it("addMessage ignores empty/whitespace bodies and missing thread ids", () => {
    const id = commentsStore.createThread({
      targetKind: "canvas",
      targetId: "c1",
      posX: 0,
      posY: 0,
    });
    commentsStore.addMessage(id, "   ");
    commentsStore.addMessage("nope-id", "hello");
    expect(commentsStore.getState().threads[0]!.messages.length).toBe(0);
    commentsStore.addMessage(id, "  real  ");
    expect(commentsStore.getState().threads[0]!.messages[0]!.body).toBe("real");
  });

  it("toggleResolved and toggleLocked flip the flags", () => {
    const id = commentsStore.createThread({
      targetKind: "edge",
      targetId: "e1",
      posX: 0,
      posY: 0,
    });
    commentsStore.toggleResolved(id);
    expect(commentsStore.getState().threads[0]!.resolved).toBe(true);
    commentsStore.toggleLocked(id);
    expect(commentsStore.getState().threads[0]!.locked).toBe(true);
    commentsStore.toggleResolved(id);
    expect(commentsStore.getState().threads[0]!.resolved).toBe(false);
  });

  it("setPosition is blocked when the thread is locked and no-ops on unchanged pos", () => {
    const id = commentsStore.createThread({
      targetKind: "file",
      targetId: "f1",
      posX: 5,
      posY: 5,
    });
    let ticks = 0;
    const unsub = commentsStore.subscribe(() => { ticks += 1; });
    commentsStore.setPosition(id, 5, 5);
    expect(ticks).toBe(0);
    commentsStore.setPosition(id, 10, 10);
    expect(commentsStore.getState().threads[0]!.posX).toBe(10);
    commentsStore.toggleLocked(id);
    const ticksBeforeLockedMove = ticks;
    commentsStore.setPosition(id, 99, 99);
    // Locked thread must not move — no new emit.
    expect(commentsStore.getState().threads[0]!.posX).toBe(10);
    expect(ticks).toBe(ticksBeforeLockedMove);
    unsub();
  });

  it("openOnFile reuses an unresolved thread", () => {
    const first = commentsStore.openOnFile("f1", 0, 0);
    const second = commentsStore.openOnFile("f1", 100, 100);
    expect(second).toBe(first);
    expect(commentsStore.getState().threads.length).toBe(1);
    commentsStore.toggleResolved(first);
    const third = commentsStore.openOnFile("f1", 0, 0);
    expect(third).not.toBe(first);
    expect(commentsStore.getState().threads.length).toBe(2);
  });

  it("extractMentionsPublic dedupes @handles", () => {
    expect(extractMentionsPublic("hi @alice and @alice-2 and @alice")).toEqual(["alice", "alice-2"]);
  });
});
