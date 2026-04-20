import { describe, it, expect, beforeEach } from "vitest";
import type {
  CommitDelta,
  CommitMeta,
  FileNode,
  GraphHistory,
  HistorySource,
  WorkspaceGraph,
} from "@quanta/canvas-engine";
import { sceneStore } from "../store/scene-store";
import { historyStore } from "../store/history-store";
import { featureFlagsStore } from "../store/feature-flags-store";
import { installTemporalHistoryBridge } from "./temporal-history-bridge";

class FakeSource implements HistorySource {
  readonly id = "fake";
  constructor(private commits: readonly CommitMeta[]) {}
  async listCommits(): Promise<readonly CommitMeta[]> { return this.commits; }
  async edgeSetAt(): Promise<ReadonlySet<string>> { return new Set(); }
  async deltaAt(sha: string): Promise<CommitDelta> { return { sha, added: [], removed: [] }; }
}

function file(id: string): FileNode {
  return {
    id, name: id, layer: "domain", riskScore: 0, loc: 1,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
  };
}

const MOCK_HISTORY: GraphHistory = { snapshots: [{ timestamp: 0, label: "mock" }], baseIndex: 0 };
// HistorySource.listCommits returns newest-first.
const GIT_COMMITS: CommitMeta[] = [
  { sha: "g2", shortSha: "g2xxxxx", timestamp: 6000, author: "a", message: "two", filesChanged: [], additions: 0, deletions: 0, parentShas: ["g1"] },
  { sha: "g1", shortSha: "g1xxxxx", timestamp: 5000, author: "a", message: "one", filesChanged: [], additions: 0, deletions: 0, parentShas: [] },
];

describe("installTemporalHistoryBridge", () => {
  beforeEach(() => {
    historyStore.reset();
    featureFlagsStore.resetToDefaults();
    featureFlagsStore.setFlag("temporal.gitSource", false);
  });

  // Regression: toggling `temporal.gitSource` with git commits loaded
  // used to infinite-recurse through `setGraphHistory → scene emit →
  // applyCurrentHistory → setGraphHistory` because `projectCommitsToGraphHistory`
  // returns a fresh object every call. This test would hang or overflow
  // before the `sameHistory` short-circuit was added.
  it("does not infinite-recurse when git commits are loaded", async () => {
    const graph: WorkspaceGraph = {
      files: [file("a"), file("b")],
      fileEdges: [],
      comments: [],
      history: MOCK_HISTORY,
    };
    sceneStore.setGraph(graph);
    historyStore.registerSourceFactory("git", () => new FakeSource(GIT_COMMITS));
    const dispose = installTemporalHistoryBridge();

    featureFlagsStore.setFlag("temporal.gitSource", true);
    await historyStore.loadCommits();
    // If the bridge is looping, this next microtask wait never resolves
    // because the main thread is pinned. The test would time out, not pass.
    await new Promise((r) => setTimeout(r, 0));

    const patched = sceneStore.getState().graph?.history;
    expect(patched).toBeDefined();
    expect(patched?.snapshots.length).toBe(GIT_COMMITS.length);
    expect(patched?.snapshots[0].commitSha).toBe("g1");

    dispose();
  });

  it("restores the original baked-in history when switching back to mock", async () => {
    const graph: WorkspaceGraph = {
      files: [file("a")],
      fileEdges: [],
      comments: [],
      history: MOCK_HISTORY,
    };
    sceneStore.setGraph(graph);
    historyStore.registerSourceFactory("git", () => new FakeSource(GIT_COMMITS));
    const dispose = installTemporalHistoryBridge();

    featureFlagsStore.setFlag("temporal.gitSource", true);
    await historyStore.loadCommits();
    await new Promise((r) => setTimeout(r, 0));
    expect(sceneStore.getState().graph?.history?.snapshots[0].commitSha).toBe("g1");

    featureFlagsStore.setFlag("temporal.gitSource", false);
    await new Promise((r) => setTimeout(r, 0));
    expect(sceneStore.getState().graph?.history).toBe(MOCK_HISTORY);

    dispose();
  });
});
