import { describe, it, expect } from "vitest";
import { computeDebtTrajectory } from "./debt-trajectory";
import type { FileEdge, FileNode } from "./types";
import type { GraphHistory } from "./history";

function mkFile(id: string): FileNode {
  return {
    id,
    name: id,
    layer: "domain",
    riskScore: 0,
    loc: 10,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 2 },
    functions: [],
  };
}

function mkEdge(id: string, from: string, to: string): FileEdge {
  return {
    id,
    from,
    to,
    kind: "import",
    layer: "structural",
    weight: 1,
  };
}

describe("computeDebtTrajectory", () => {
  it("produces a row per snapshot with sccCount + edge/file counts", () => {
    const eAB = mkEdge("AB", "A", "B");
    const eBC = mkEdge("BC", "B", "C");
    const eCA = mkEdge("CA", "C", "A");
    const files = [mkFile("A"), mkFile("B"), mkFile("C")];
    const edges = [eAB, eBC, eCA];
    const history: GraphHistory = {
      snapshots: [
        { timestamp: 1, label: "init", commitSha: "sha0", edgeIds: [eAB.id] },
        { timestamp: 2, label: "grow", commitSha: "sha1", added: [eBC.id] },
        { timestamp: 3, label: "close", commitSha: "sha2", added: [eCA.id] },
      ],
    };
    const series = computeDebtTrajectory(history, { files, fileEdges: edges });
    expect(series.length).toBe(3);
    expect(series[0].sccCount).toBe(0);
    expect(series[1].sccCount).toBe(0);
    expect(series[2].sccCount).toBe(1);
    expect(series[2].edgeCount).toBe(3);
    expect(series[0].fileCount).toBe(3);
    expect(series.map(s => s.sha)).toEqual(["sha0", "sha1", "sha2"]);
  });

  it("returns empty for empty history", () => {
    const series = computeDebtTrajectory({ snapshots: [] }, { files: [], fileEdges: [] });
    expect(series).toEqual([]);
  });

  it("uses index-based sha when commitSha absent", () => {
    const e = mkEdge("e", "a", "b");
    const files = [mkFile("a"), mkFile("b")];
    const history: GraphHistory = {
      snapshots: [{ timestamp: 1, label: "only", edgeIds: [e.id] }],
    };
    const series = computeDebtTrajectory(history, { files, fileEdges: [e] });
    expect(series[0].sha).toBe("idx:0");
  });
});
