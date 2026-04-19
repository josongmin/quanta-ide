import { describe, it, expect } from "vitest";
import { materializeEdgeSet, diffSnapshots } from "./history";
import type { GraphHistory } from "./history";

describe("graph history", () => {
  const history: GraphHistory = {
    snapshots: [
      { timestamp: 1, label: "day-0", edgeIds: ["e1", "e2"] },
      { timestamp: 2, label: "day-1", added: ["e3"] },
      { timestamp: 3, label: "day-2", added: ["e4"], removed: ["e1"] },
    ],
  };

  it("materializeEdgeSet returns baseline at index 0", () => {
    const s = materializeEdgeSet(history, 0);
    expect([...s].sort()).toEqual(["e1", "e2"]);
  });

  it("materializeEdgeSet applies one forward delta", () => {
    const s = materializeEdgeSet(history, 1);
    expect([...s].sort()).toEqual(["e1", "e2", "e3"]);
  });

  it("materializeEdgeSet applies multiple forward deltas with removals", () => {
    const s = materializeEdgeSet(history, 2);
    expect([...s].sort()).toEqual(["e2", "e3", "e4"]);
  });

  it("diffSnapshots 0→2 reports added/removed/unchanged", () => {
    const d = diffSnapshots(history, 0, 2);
    expect([...d.added].sort()).toEqual(["e3", "e4"]);
    expect([...d.removed].sort()).toEqual(["e1"]);
    expect([...d.unchanged].sort()).toEqual(["e2"]);
  });

  it("diffSnapshots with identical indices has no delta", () => {
    const d = diffSnapshots(history, 1, 1);
    expect(d.added.size).toBe(0);
    expect(d.removed.size).toBe(0);
    expect([...d.unchanged].sort()).toEqual(["e1", "e2", "e3"]);
  });

  it("out-of-range indices return an empty set", () => {
    expect(materializeEdgeSet(history, -1).size).toBe(0);
    expect(materializeEdgeSet(history, 99).size).toBe(0);
  });

  it("baseIndex > 0 anchors the walk", () => {
    const h: GraphHistory = {
      baseIndex: 1,
      snapshots: [
        { timestamp: 1, label: "ignored", edgeIds: ["nope"] },
        { timestamp: 2, label: "base", edgeIds: ["a", "b"] },
        { timestamp: 3, label: "next", added: ["c"] },
      ],
    };
    expect([...materializeEdgeSet(h, 1)].sort()).toEqual(["a", "b"]);
    expect([...materializeEdgeSet(h, 2)].sort()).toEqual(["a", "b", "c"]);
  });
});
