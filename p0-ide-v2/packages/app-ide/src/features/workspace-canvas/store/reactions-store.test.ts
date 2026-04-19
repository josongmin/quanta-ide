import { describe, it, expect, beforeEach } from "vitest";
import { reactionsStore, groupReactions } from "./reactions-store";

describe("reactions-store", () => {
  beforeEach(() => {
    reactionsStore.reset();
  });

  it("react adds a reaction and returns its id", () => {
    const id = reactionsStore.react({ kind: "file", id: "f1" }, "🔥", "alice");
    expect(id).not.toBeNull();
    expect(reactionsStore.getState().reactions.length).toBe(1);
  });

  it("react toggles off when the same (target, author, emoji) exists", () => {
    reactionsStore.react({ kind: "file", id: "f1" }, "🔥", "alice");
    const second = reactionsStore.react({ kind: "file", id: "f1" }, "🔥", "alice");
    expect(second).toBeNull();
    expect(reactionsStore.getState().reactions.length).toBe(0);
  });

  it("listFor filters by target kind+id", () => {
    reactionsStore.react({ kind: "file", id: "f1" }, "🔥", "alice");
    reactionsStore.react({ kind: "file", id: "f1" }, "🚀", "bob");
    reactionsStore.react({ kind: "edge", id: "f1" }, "🔥", "alice");
    const list = reactionsStore.listFor({ kind: "file", id: "f1" });
    expect(list.length).toBe(2);
  });

  it("unreact on unknown id does not emit", () => {
    let ticks = 0;
    const unsub = reactionsStore.subscribe(() => { ticks += 1; });
    reactionsStore.unreact("ghost");
    expect(ticks).toBe(0);
    unsub();
  });

  it("groupReactions buckets by emoji and flags byYou", () => {
    const list = reactionsStore.listFor({ kind: "file", id: "f1" });
    reactionsStore.react({ kind: "file", id: "f1" }, "🔥", "alice");
    reactionsStore.react({ kind: "file", id: "f1" }, "🔥", "you");
    reactionsStore.react({ kind: "file", id: "f1" }, "🚀", "bob");
    const current = reactionsStore.listFor({ kind: "file", id: "f1" });
    expect(list.length).toBe(0);
    const groups = groupReactions(current, "you");
    const fire = groups.find(g => g.emoji === "🔥");
    const rocket = groups.find(g => g.emoji === "🚀");
    expect(fire?.count).toBe(2);
    expect(fire?.byYou).toBe(true);
    expect(rocket?.count).toBe(1);
    expect(rocket?.byYou).toBe(false);
  });
});
