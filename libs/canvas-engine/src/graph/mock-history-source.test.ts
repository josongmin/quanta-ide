import { describe, it, expect } from "vitest";
import { MockHistorySource } from "./mock-history-source";
import type { GraphHistory } from "./history";
import type { FileEdge } from "./types";

const EDGES: readonly FileEdge[] = [
  { id: "e1", from: "a.ts", to: "b.ts", kind: "import", layer: "structural", weight: 1 },
  { id: "e2", from: "a.ts", to: "c.ts", kind: "import", layer: "structural", weight: 1 },
  { id: "e3", from: "b.ts", to: "c.ts", kind: "import", layer: "structural", weight: 1 },
  { id: "e4", from: "d.ts", to: "b.ts", kind: "import", layer: "structural", weight: 1 },
];

const HISTORY: GraphHistory = {
  snapshots: [
    { timestamp: 1_700_000_000_000, label: "day-0", edgeIds: ["e1", "e2"] },
    { timestamp: 1_700_086_400_000, label: "day-1", added: ["e3"] },
    { timestamp: 1_700_172_800_000, label: "day-2", added: ["e4"], removed: ["e1"] },
  ],
  baseIndex: 0,
};

describe("MockHistorySource", () => {
  it("listCommits returns metas newest-first", async () => {
    const src = new MockHistorySource(HISTORY, EDGES);
    const commits = await src.listCommits();
    expect(commits.length).toBe(3);
    expect(commits[0].timestamp).toBeGreaterThan(commits[1].timestamp);
    expect(commits[1].timestamp).toBeGreaterThan(commits[2].timestamp);
    // Authors cycle alice/bob/charlie/dana on the CHRONOLOGICAL order
    // (root commit = alice). Reverse order means newest-first: commit
    // index 2 in chronological → author "charlie".
    expect(commits[0].author).toBe("charlie");
    expect(commits[2].author).toBe("alice");
  });

  it("metas carry short + long shas, parents link to previous", async () => {
    const src = new MockHistorySource(HISTORY, EDGES);
    const commits = await src.listCommits();
    const chrono = [...commits].reverse();
    expect(chrono[0].parentShas).toEqual([]);
    expect(chrono[1].parentShas).toEqual([chrono[0].sha]);
    expect(chrono[2].parentShas).toEqual([chrono[1].sha]);
    for (const c of commits) {
      expect(c.sha.length).toBe(40);
      expect(c.shortSha.length).toBe(7);
    }
  });

  it("listCommits applies limit + since filters", async () => {
    const src = new MockHistorySource(HISTORY, EDGES);
    const two = await src.listCommits({ limit: 2 });
    expect(two.length).toBe(2);

    const since = 1_700_100_000_000;
    const recent = await src.listCommits({ since });
    expect(recent.every(c => c.timestamp >= since)).toBe(true);
  });

  it("edgeSetAt matches materialized edge set for that snapshot", async () => {
    const src = new MockHistorySource(HISTORY, EDGES);
    const commits = await src.listCommits();
    // Newest commit is the snapshot at index 2 ({e2, e3, e4}).
    const newest = await src.edgeSetAt(commits[0].sha);
    expect([...newest].sort()).toEqual(["e2", "e3", "e4"]);
    // Oldest commit is the baseline ({e1, e2}).
    const oldest = await src.edgeSetAt(commits[2].sha);
    expect([...oldest].sort()).toEqual(["e1", "e2"]);
  });

  it("edgeSetAt on unknown sha returns empty set", async () => {
    const src = new MockHistorySource(HISTORY, EDGES);
    const set = await src.edgeSetAt("deadbeef");
    expect(set.size).toBe(0);
  });

  it("deltaAt returns per-commit add/remove", async () => {
    const src = new MockHistorySource(HISTORY, EDGES);
    const commits = await src.listCommits();
    // Middle commit (chronological index 1) added e3.
    const mid = await src.deltaAt(commits[1].sha);
    expect([...mid.added].sort()).toEqual(["e3"]);
    expect([...mid.removed].sort()).toEqual([]);
    // Newest commit added e4, removed e1.
    const newest = await src.deltaAt(commits[0].sha);
    expect([...newest.added].sort()).toEqual(["e4"]);
    expect([...newest.removed].sort()).toEqual(["e1"]);
  });

  it("deltaAt on unknown sha returns empty delta", async () => {
    const src = new MockHistorySource(HISTORY, EDGES);
    const d = await src.deltaAt("missing");
    expect(d.added.length).toBe(0);
    expect(d.removed.length).toBe(0);
    expect(d.sha).toBe("missing");
  });

  it("source id defaults to 'mock' and can be overridden", async () => {
    expect(new MockHistorySource(HISTORY, EDGES).id).toBe("mock");
    expect(new MockHistorySource(HISTORY, EDGES, { id: "fixture-a" }).id).toBe("fixture-a");
  });
});
