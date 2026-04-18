import { describe, it, expect } from "vitest";
import { aggregateClusterEdges, routeClusterEdges } from "./cluster-edge-aggregate";
import type { FileEdge } from "../graph/types";
import type { ClusterMeta } from "./types";

// Minimal fixture helpers — only `from`/`to`/`kind`/`severity` are read by
// the aggregator; other fields exist only because FileEdge requires them.
function e(
  id: string,
  from: string,
  to: string,
  kind: FileEdge["kind"],
  severity?: FileEdge["severity"],
): FileEdge {
  return {
    id,
    from,
    to,
    kind,
    layer: "structural", // ignored by aggregator — it re-derives via deriveEdgeLayer
    weight: 1,
    severity,
  };
}

describe("aggregateClusterEdges", () => {
  // 4 files across 2 clusters; 6 edges chosen to exercise:
  //   - one (A→B, call) bucket with 2 contributors
  //   - one (A→B, import) bucket with 1 contributor
  //   - one (B→A, call) bucket with 1 contributor (directional — distinct)
  //   - one (A→B, taint-propagation) bucket with severity escalation
  //   - one A→A self-loop that must be skipped
  const clusterOf = new Map<string, string>([
    ["crates/a/x.rs", "crates/a"],
    ["crates/a/y.rs", "crates/a"],
    ["crates/b/p.rs", "crates/b"],
    ["crates/b/q.rs", "crates/b"],
  ]);

  const fileEdges: FileEdge[] = [
    e("1", "crates/a/x.rs", "crates/b/p.rs", "call"),
    e("2", "crates/a/y.rs", "crates/b/q.rs", "call"),
    e("3", "crates/a/x.rs", "crates/b/p.rs", "import"),
    e("4", "crates/b/p.rs", "crates/a/x.rs", "call"),
    e("5", "crates/a/x.rs", "crates/b/q.rs", "taint-propagation", "low"),
    e("6", "crates/a/y.rs", "crates/b/p.rs", "taint-propagation", "critical"),
    // Self-loop inside cluster A — must be skipped.
    e("7", "crates/a/x.rs", "crates/a/y.rs", "call"),
  ];

  const result = aggregateClusterEdges({ fileEdges, clusterOf });

  it("produces one bucket per (from, to, kind)", () => {
    expect(result.length).toBe(4);
  });

  it("skips self-loops", () => {
    const hasSelf = result.some(e => e.fromClusterId === e.toClusterId);
    expect(hasSelf).toBe(false);
  });

  it("keeps A→B and B→A as distinct directional buckets", () => {
    const ab = result.find(e => e.fromClusterId === "crates/a" && e.toClusterId === "crates/b" && e.kind === "call");
    const ba = result.find(e => e.fromClusterId === "crates/b" && e.toClusterId === "crates/a" && e.kind === "call");
    expect(ab).toBeDefined();
    expect(ba).toBeDefined();
    expect(ab?.count).toBe(2);
    expect(ba?.count).toBe(1);
  });

  it("derives layer from kind", () => {
    const callBucket = result.find(e => e.kind === "call" && e.fromClusterId === "crates/a");
    const taintBucket = result.find(e => e.kind === "taint-propagation");
    expect(callBucket?.layer).toBe("structural");
    expect(taintBucket?.layer).toBe("safety");
  });

  it("picks maxSeverity across contributors", () => {
    const taintBucket = result.find(e => e.kind === "taint-propagation");
    // contributors: low + critical → max = critical.
    expect(taintBucket?.maxSeverity).toBe("critical");
  });

  it("leaves maxSeverity undefined when no contributor had one", () => {
    const callAB = result.find(e => e.kind === "call" && e.fromClusterId === "crates/a");
    expect(callAB?.maxSeverity).toBeUndefined();
  });

  it("assigns deterministic ids", () => {
    const callAB = result.find(e => e.kind === "call" && e.fromClusterId === "crates/a");
    expect(callAB?.id).toBe("crates/a\u2192crates/b:call");
  });

  it("routes bezier center-to-center when clusters are provided", () => {
    const clusters: ClusterMeta[] = [
      { id: "crates/a", rect: { x: 0, y: 0, w: 100, h: 100 }, fileCount: 2, locSum: 0 },
      { id: "crates/b", rect: { x: 200, y: 0, w: 100, h: 100 }, fileCount: 2, locSum: 0 },
    ];
    const routed = routeClusterEdges([...result], clusters);
    const callAB = routed.find(e => e.kind === "call" && e.fromClusterId === "crates/a");
    expect(callAB?.route).toBeDefined();
    expect(callAB?.route?.x1).toBe(50);
    expect(callAB?.route?.y1).toBe(50);
    expect(callAB?.route?.x2).toBe(250);
    expect(callAB?.route?.y2).toBe(50);
  });
});
