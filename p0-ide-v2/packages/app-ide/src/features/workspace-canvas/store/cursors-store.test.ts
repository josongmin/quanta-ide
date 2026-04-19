import { describe, it, expect, beforeEach, vi } from "vitest";
import { cursorsStore } from "./cursors-store";

describe("cursors-store", () => {
  beforeEach(() => {
    cursorsStore.reset();
  });

  it("setCursor creates a new cursor when the id is unknown", () => {
    cursorsStore.setCursor("u1", {
      color: "#ff0000",
      label: "Alice",
      worldX: 10,
      worldY: 20,
    });
    const { cursors } = cursorsStore.getState();
    expect(cursors).toHaveLength(1);
    expect(cursors[0]?.userId).toBe("u1");
    expect(cursors[0]?.color).toBe("#ff0000");
    expect(cursors[0]?.worldX).toBe(10);
    expect(cursors[0]?.worldY).toBe(20);
  });

  it("setCursor short-circuits when x/y/color/label are unchanged", () => {
    cursorsStore.setCursor("u1", {
      color: "#00ff00",
      label: "Bob",
      worldX: 5,
      worldY: 5,
    });
    const listener = vi.fn();
    const unsubscribe = cursorsStore.subscribe(listener);
    // Same patch — updatedAt is overwritten internally, so this is a no-op.
    cursorsStore.setCursor("u1", {
      color: "#00ff00",
      label: "Bob",
      worldX: 5,
      worldY: 5,
    });
    expect(listener).not.toHaveBeenCalled();
    // Movement triggers an emission.
    cursorsStore.setCursor("u1", { worldX: 6, worldY: 5 });
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("removeCursor drops the target and short-circuits on missing id", () => {
    cursorsStore.setCursor("u1", { worldX: 1, worldY: 1 });
    cursorsStore.setCursor("u2", { worldX: 2, worldY: 2 });
    const listener = vi.fn();
    const unsubscribe = cursorsStore.subscribe(listener);
    cursorsStore.removeCursor("u1");
    expect(cursorsStore.getState().cursors).toHaveLength(1);
    expect(listener).toHaveBeenCalledTimes(1);
    // Removing an unknown id does not emit.
    cursorsStore.removeCursor("does-not-exist");
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
