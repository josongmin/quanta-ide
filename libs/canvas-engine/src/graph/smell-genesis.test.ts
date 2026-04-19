import { describe, it, expect } from "vitest";
import { findSmellGenesis } from "./smell-genesis";
import type { FileEdge, FileNode, ArchLayer } from "./types";
import type { GraphHistory } from "./history";

function mkFile(id: string, layer: ArchLayer, riskScore = 0): FileNode {
  return {
    id,
    name: id,
    layer,
    riskScore,
    loc: 10,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 1 },
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

describe("findSmellGenesis", () => {
  it("detects cycle-member at the snapshot the cycle closes", () => {
    const eAB = mkEdge("AB", "A", "B");
    const eBC = mkEdge("BC", "B", "C");
    const eCA = mkEdge("CA", "C", "A");
    const currentGraph = {
      files: [mkFile("A", "domain"), mkFile("B", "domain"), mkFile("C", "domain")],
      fileEdges: [eAB, eBC, eCA],
    };
    const history: GraphHistory = {
      snapshots: [
        { timestamp: 1, label: "s0", commitSha: "sha0", edgeIds: [eAB.id] },
        { timestamp: 2, label: "s1", commitSha: "sha1", added: [eBC.id] },
        { timestamp: 3, label: "s2", commitSha: "sha2", added: [eCA.id] },
      ],
    };
    const result = findSmellGenesis("A", "cycle-member", history, currentGraph);
    expect(result?.firstSeenSha).toBe("sha2");
  });

  it("detects high-coupling at the first snapshot meeting the threshold", () => {
    // 3 snapshots: deg 3, deg 6, deg 15. Threshold 10 → snapshot 3.
    const currentGraph = {
      files: [mkFile("hub", "domain"), ...Array.from({ length: 20 }, (_, i) => mkFile(`f${i}`, "domain"))],
      fileEdges: Array.from({ length: 20 }, (_, i) => mkEdge(`e${i}`, `f${i}`, "hub")),
    };
    const first: string[] = Array.from({ length: 3 }, (_, i) => `e${i}`);
    const second: string[] = Array.from({ length: 3 }, (_, i) => `e${3 + i}`);
    const third: string[] = Array.from({ length: 9 }, (_, i) => `e${6 + i}`);
    const history: GraphHistory = {
      snapshots: [
        { timestamp: 1, label: "s0", commitSha: "a", edgeIds: first },
        { timestamp: 2, label: "s1", commitSha: "b", added: second },
        { timestamp: 3, label: "s2", commitSha: "c", added: third },
      ],
    };
    const result = findSmellGenesis("hub", "high-coupling", history, currentGraph, {
      couplingThreshold: 10,
    });
    expect(result?.firstSeenSha).toBe("c");
  });

  it("returns null when the smell never applies", () => {
    const eAB = mkEdge("AB", "A", "B");
    const currentGraph = {
      files: [mkFile("A", "domain"), mkFile("B", "domain")],
      fileEdges: [eAB],
    };
    const history: GraphHistory = {
      snapshots: [
        { timestamp: 1, label: "s0", commitSha: "sha0", edgeIds: [eAB.id] },
      ],
    };
    expect(findSmellGenesis("A", "cycle-member", history, currentGraph)).toBeNull();
  });
});
