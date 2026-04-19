import { describe, it, expect, beforeEach } from "vitest";
import { estimationStore, statsFor, allFileIdsWithEstimates, scoreToNumber } from "./estimation-store";

describe("estimation-store", () => {
  beforeEach(() => {
    estimationStore.reset();
  });

  it("estimate stores at most one entry per (file, voter)", () => {
    estimationStore.estimate("f1", 3, "alice");
    estimationStore.estimate("f1", 8, "alice");
    const list = estimationStore.estimatesFor("f1");
    expect(list.length).toBe(1);
    expect(list[0]!.score).toBe(8);
  });

  it("clearEstimate removes only the (file, voter) pair", () => {
    estimationStore.estimate("f1", 5, "alice");
    estimationStore.estimate("f1", 13, "bob");
    estimationStore.clearEstimate("f1", "alice");
    const rest = estimationStore.estimatesFor("f1");
    expect(rest.length).toBe(1);
    expect(rest[0]!.voterId).toBe("bob");
  });

  it("clearEstimate on missing pair does not emit", () => {
    let ticks = 0;
    const unsub = estimationStore.subscribe(() => { ticks += 1; });
    estimationStore.clearEstimate("ghost", "you");
    expect(ticks).toBe(0);
    unsub();
  });

  it("statsFor computes median/mean and returns null for empty", () => {
    expect(statsFor(estimationStore.getState(), "empty").median).toBeNull();
    estimationStore.estimate("f1", 1, "a");
    estimationStore.estimate("f1", 3, "b");
    estimationStore.estimate("f1", 5, "c");
    estimationStore.estimate("f1", "?", "d");
    const stats = statsFor(estimationStore.getState(), "f1");
    expect(stats.count).toBe(4);
    expect(stats.median).toBe(3);
    expect(stats.mean).toBe(3);
    expect(stats.stddev).toBeGreaterThan(0);
  });

  it("allFileIdsWithEstimates returns unique ids; scoreToNumber handles '?'", () => {
    estimationStore.estimate("f1", 2, "a");
    estimationStore.estimate("f2", "?", "b");
    const ids = allFileIdsWithEstimates(estimationStore.getState());
    expect(new Set(ids)).toEqual(new Set(["f1", "f2"]));
    expect(scoreToNumber("?")).toBeNull();
    expect(scoreToNumber(8)).toBe(8);
  });
});
