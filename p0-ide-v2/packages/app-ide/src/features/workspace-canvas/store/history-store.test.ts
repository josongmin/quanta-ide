import { describe, it, expect, beforeEach } from "vitest";
import { historyStore } from "./history-store";
import { featureFlagsStore } from "./feature-flags-store";
import type { CommitMeta, HistorySource, CommitDelta } from "@quanta/canvas-engine";

class FakeSource implements HistorySource {
  readonly id: string;
  private commits: readonly CommitMeta[];
  constructor(id: string, commits: readonly CommitMeta[]) {
    this.id = id;
    this.commits = commits;
  }
  async listCommits(opts: { limit?: number; since?: number } = {}): Promise<readonly CommitMeta[]> {
    let out = this.commits;
    if (opts.since != null) out = out.filter(c => c.timestamp >= opts.since!);
    if (opts.limit != null) out = out.slice(0, opts.limit);
    return out;
  }
  async edgeSetAt(): Promise<ReadonlySet<string>> { return new Set(); }
  async deltaAt(sha: string): Promise<CommitDelta> { return { sha, added: [], removed: [] }; }
}

const MOCK_COMMITS: CommitMeta[] = [
  { sha: "m2", shortSha: "m2xxxxx", timestamp: 2000, author: "a", message: "b", filesChanged: [], additions: 0, deletions: 0, parentShas: ["m1"] },
  { sha: "m1", shortSha: "m1xxxxx", timestamp: 1000, author: "a", message: "a", filesChanged: [], additions: 0, deletions: 0, parentShas: [] },
];
const GIT_COMMITS: CommitMeta[] = [
  { sha: "g1", shortSha: "g1xxxxx", timestamp: 5000, author: "a", message: "r", filesChanged: [], additions: 0, deletions: 0, parentShas: [] },
];

describe("historyStore", () => {
  beforeEach(() => {
    historyStore.reset();
    featureFlagsStore.resetToDefaults();
    featureFlagsStore.setFlag("temporal.gitSource", false);
  });

  it("registerSourceFactory makes the source available for loads", async () => {
    historyStore.registerSourceFactory("mock", () => new FakeSource("mock", MOCK_COMMITS));
    await historyStore.loadCommits();
    const s = historyStore.getState();
    expect(s.kind).toBe("mock");
    expect(s.commits.length).toBe(2);
    expect(s.loadEpoch).toBe(1);
    expect(s.loading).toBe(false);
  });

  it("setCurrentSha moves the time-travel pointer", () => {
    historyStore.setCurrentSha("abc");
    expect(historyStore.getState().currentSha).toBe("abc");
    historyStore.setCurrentSha(null);
    expect(historyStore.getState().currentSha).toBe(null);
  });

  it("swaps source when the temporal.gitSource flag flips", async () => {
    historyStore.registerSourceFactory("mock", () => new FakeSource("mock", MOCK_COMMITS));
    historyStore.registerSourceFactory("git", () => new FakeSource("git", GIT_COMMITS));
    await historyStore.loadCommits();
    expect(historyStore.getState().kind).toBe("mock");

    featureFlagsStore.setFlag("temporal.gitSource", true);
    expect(historyStore.getState().kind).toBe("git");
    // Swap should clear the previous commits.
    expect(historyStore.getState().commits.length).toBe(0);

    await historyStore.loadCommits();
    expect(historyStore.getState().commits[0].sha).toBe("g1");
  });

  it("loadCommits surfaces errors without crashing", async () => {
    class BadSource implements HistorySource {
      readonly id = "bad";
      async listCommits(): Promise<readonly CommitMeta[]> { throw new Error("boom"); }
      async edgeSetAt(): Promise<ReadonlySet<string>> { return new Set(); }
      async deltaAt(sha: string): Promise<CommitDelta> { return { sha, added: [], removed: [] }; }
    }
    historyStore.registerSourceFactory("mock", () => new BadSource());
    await historyStore.loadCommits();
    const s = historyStore.getState();
    expect(s.error).toContain("boom");
    expect(s.loading).toBe(false);
  });

  it("loadCommits falls through to the provider when no factory is registered", async () => {
    // WHY: post-V3, the store no longer errors when no factory is
    // registered — it falls back to `getHistorySource()` from the
    // provider, which returns a mock source seeded from SAMPLE_GRAPH.
    await historyStore.loadCommits();
    const s = historyStore.getState();
    expect(s.error).toBeNull();
    expect(s.source).not.toBeNull();
  });
});
