import { describe, it, expect, beforeEach } from "vitest";
import { reviewStateStore, countByLane } from "./review-state-store";

describe("review-state-store", () => {
  beforeEach(() => {
    reviewStateStore.reset();
  });

  it("laneOf defaults to 'todo' for unseen files", () => {
    expect(reviewStateStore.laneOf("never-seen")).toBe("todo");
  });

  it("setLane updates state; clearLane removes the entry", () => {
    reviewStateStore.setLane("f1", "review");
    expect(reviewStateStore.laneOf("f1")).toBe("review");
    reviewStateStore.clearLane("f1");
    expect(reviewStateStore.laneOf("f1")).toBe("todo");
  });

  it("setLane short-circuits on unchanged value", () => {
    reviewStateStore.setLane("f1", "approved");
    let ticks = 0;
    const unsub = reviewStateStore.subscribe(() => { ticks += 1; });
    reviewStateStore.setLane("f1", "approved");
    expect(ticks).toBe(0);
    unsub();
  });

  it("clearLane on unknown fileId does not emit", () => {
    let ticks = 0;
    const unsub = reviewStateStore.subscribe(() => { ticks += 1; });
    reviewStateStore.clearLane("ghost");
    expect(ticks).toBe(0);
    unsub();
  });

  it("countByLane tallies per lane with todo fallback", () => {
    reviewStateStore.setLane("a", "review");
    reviewStateStore.setLane("b", "approved");
    reviewStateStore.setLane("c", "approved");
    const counts = countByLane(reviewStateStore.getState(), ["a", "b", "c", "d"]);
    expect(counts).toEqual({ todo: 1, review: 1, approved: 2 });
  });

  it("toggleKanban flips kanbanVisible", () => {
    expect(reviewStateStore.getState().kanbanVisible).toBe(false);
    reviewStateStore.toggleKanban();
    expect(reviewStateStore.getState().kanbanVisible).toBe(true);
  });
});
