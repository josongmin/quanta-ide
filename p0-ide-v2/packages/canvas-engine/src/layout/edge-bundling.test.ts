import { describe, it, expect } from "vitest";
import { buildBundledEdges, buildFileToClusterMap } from "./edge-bundling";
import type { FileEdge, FileNode, Rect } from "../graph/types";
import type { ClusterMeta } from "./types";

function makeFile(id: string): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "unknown",
    riskScore: 0,
    loc: 10,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 1 },
    functions: [],
  };
}

function edge(id: string, from: string, to: string): FileEdge {
  return { id, from, to, kind: "call", layer: "structural", weight: 1 };
}

const clusters: ClusterMeta[] = [
  { id: "crates/a", rect: { x: 0, y: 0, w: 100, h: 100 }, fileCount: 2, locSum: 0 },
  { id: "crates/b", rect: { x: 300, y: 0, w: 100, h: 100 }, fileCount: 2, locSum: 0 },
  { id: "crates/c", rect: { x: 600, y: 0, w: 100, h: 100 }, fileCount: 1, locSum: 0 },
];

describe("buildBundledEdges", () => {
  it("bundles two near-parallel edges between the same cluster pair into one trunk", () => {
    const fileToCluster = new Map<string, string>([
      ["crates/a/x.rs", "crates/a"],
      ["crates/a/y.rs", "crates/a"],
      ["crates/b/p.rs", "crates/b"],
      ["crates/b/q.rs", "crates/b"],
    ]);
    const edges = [
      edge("1", "crates/a/x.rs", "crates/b/p.rs"),
      edge("2", "crates/a/y.rs", "crates/b/q.rs"),
    ];
    const bundled = buildBundledEdges(edges, fileToCluster, clusters);
    expect(bundled.length).toBe(1);
    expect(bundled[0].count).toBe(2);
  });

  it("keeps edges across different cluster pairs as separate trunks", () => {
    const fileToCluster = new Map<string, string>([
      ["crates/a/x.rs", "crates/a"],
      ["crates/b/p.rs", "crates/b"],
      ["crates/c/z.rs", "crates/c"],
    ]);
    const edges = [
      edge("1", "crates/a/x.rs", "crates/b/p.rs"),
      edge("2", "crates/a/x.rs", "crates/c/z.rs"),
    ];
    const bundled = buildBundledEdges(edges, fileToCluster, clusters);
    expect(bundled.length).toBe(2);
    const pairs = new Set(bundled.map(b => `${b.fromClusterId}|${b.toClusterId}`));
    expect(pairs.size).toBe(2);
  });

  it("returns empty array for empty edge input", () => {
    const fileToCluster = new Map<string, string>();
    expect(buildBundledEdges([], fileToCluster, clusters)).toEqual([]);
  });

  it("passes a single edge through unchanged (count = 1)", () => {
    const fileToCluster = new Map<string, string>([
      ["crates/a/x.rs", "crates/a"],
      ["crates/b/p.rs", "crates/b"],
    ]);
    const bundled = buildBundledEdges(
      [edge("solo", "crates/a/x.rs", "crates/b/p.rs")],
      fileToCluster,
      clusters,
    );
    expect(bundled.length).toBe(1);
    expect(bundled[0].count).toBe(1);
  });

  it("drops intra-cluster edges", () => {
    const fileToCluster = new Map<string, string>([
      ["crates/a/x.rs", "crates/a"],
      ["crates/a/y.rs", "crates/a"],
    ]);
    const bundled = buildBundledEdges(
      [edge("loop", "crates/a/x.rs", "crates/a/y.rs")],
      fileToCluster,
      clusters,
    );
    expect(bundled).toEqual([]);
  });

  it("buildFileToClusterMap matches by path prefix", () => {
    const files = [makeFile("crates/a/src/x.rs"), makeFile("crates/b/src/y.rs")];
    const rects = new Map<string, Rect>();
    const map = buildFileToClusterMap(files, rects, clusters);
    expect(map.get("crates/a/src/x.rs")).toBe("crates/a");
    expect(map.get("crates/b/src/y.rs")).toBe("crates/b");
  });
});
