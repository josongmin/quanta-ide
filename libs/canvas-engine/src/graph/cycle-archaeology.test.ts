import { describe, it, expect } from "vitest";
import { findCycleGenesis } from "./cycle-archaeology";
import type { FileEdge } from "./types";
import type { GraphHistory } from "./history";

function mkEdge(from: string, to: string): FileEdge {
  return {
    id: `${from}->${to}`,
    from,
    to,
    kind: "import",
    layer: "structural",
    weight: 1,
  };
}

describe("findCycleGenesis", () => {
  it("finds the snapshot where the closing edge is added", () => {
    const eab = mkEdge("A", "B");
    const ebc = mkEdge("B", "C");
    const eca = mkEdge("C", "A");
    const edgeIndex = new Map([eab, ebc, eca].map(e => [e.id, e]));
    const history: GraphHistory = {
      snapshots: [
        { timestamp: 1, label: "s0", commitSha: "sha-0", edgeIds: [eab.id] },
        { timestamp: 2, label: "s1", commitSha: "sha-1", added: [ebc.id] },
        { timestamp: 3, label: "s2", commitSha: "sha-2", added: [eca.id] },
      ],
    };
    const result = findCycleGenesis(["A", "B", "C"], history, edgeIndex);
    expect(result.formedAtSha).toBe("sha-2");
    expect(result.formedAtTimestamp).toBe(3);
    expect(result.introducingEdge).toEqual({ from: "C", to: "A", kind: "import" });
  });

  it("returns null sha when the cycle is present at baseline", () => {
    const eab = mkEdge("A", "B");
    const eba = mkEdge("B", "A");
    const edgeIndex = new Map([eab, eba].map(e => [e.id, e]));
    const history: GraphHistory = {
      snapshots: [
        { timestamp: 1, label: "start", commitSha: "sha-start", edgeIds: [eab.id, eba.id] },
      ],
    };
    const result = findCycleGenesis(["A", "B"], history, edgeIndex);
    // Baseline already contains the cycle — `formedAtSha` should be the
    // baseline sha (first snapshot where it exists).
    expect(result.formedAtSha).toBe("sha-start");
    expect(result.introducingEdge).toBeDefined();
  });

  it("returns null when SCC never closes in the recorded history", () => {
    const eab = mkEdge("A", "B");
    const edgeIndex = new Map([[eab.id, eab]]);
    const history: GraphHistory = {
      snapshots: [
        { timestamp: 1, label: "only", commitSha: "sha-only", edgeIds: [eab.id] },
      ],
    };
    const result = findCycleGenesis(["A", "B"], history, edgeIndex);
    expect(result.formedAtSha).toBe(null);
  });

  it("ignores edge kinds outside import/call when hunting for cycles", () => {
    const flowEdge: FileEdge = { ...mkEdge("A", "B"), kind: "dataflow", layer: "flow" };
    const flowBack: FileEdge = { ...mkEdge("B", "A"), kind: "dataflow", layer: "flow" };
    const edgeIndex = new Map([flowEdge, flowBack].map(e => [e.id, e]));
    const history: GraphHistory = {
      snapshots: [
        { timestamp: 1, label: "init", commitSha: "s1", edgeIds: [flowEdge.id, flowBack.id] },
      ],
    };
    const result = findCycleGenesis(["A", "B"], history, edgeIndex);
    // No structural closure → treated as never formed.
    expect(result.formedAtSha).toBe(null);
  });
});
