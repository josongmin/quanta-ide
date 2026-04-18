import { describe, it, expect } from "vitest";
import { treemapLayout } from "./treemap-layout";
import type { WorkspaceGraph, FileNode } from "../graph/types";

// Build a synthetic graph with `n` files distributed across `dirs`
// top-level directories. Each file gets a minimum-shape FileNode;
// treemapLayout only reads `id` and `loc`.
function makeFile(id: string, loc = 100): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "unknown",
    riskScore: 0.1,
    loc,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 1 },
    functions: [],
  };
}

function makeGraph(ids: string[]): WorkspaceGraph {
  return {
    files: ids.map(id => makeFile(id)),
    fileEdges: [],
    comments: [],
  };
}

describe("treemapLayout", () => {
  describe("small balanced graph (10 files / 3 dirs)", () => {
    // 3 dirs, slightly uneven counts, exercises the squarify path.
    const graph = makeGraph([
      "crates/alpha/src/a.rs",
      "crates/alpha/src/b.rs",
      "crates/alpha/src/c.rs",
      "crates/alpha/src/d.rs",
      "crates/beta/src/e.rs",
      "crates/beta/src/f.rs",
      "crates/beta/src/g.rs",
      "crates/gamma/src/h.rs",
      "crates/gamma/src/i.rs",
      "crates/gamma/src/j.rs",
    ]);
    const result = treemapLayout(graph);

    it("preserves file count", () => {
      expect(result.fileRects.size).toBe(10);
    });

    it("produces no duplicate positions", () => {
      const seen = new Set<string>();
      for (const [, r] of result.fileRects) {
        const k = `${r.x}:${r.y}`;
        expect(seen.has(k)).toBe(false);
        seen.add(k);
      }
    });

    it("every file has a non-degenerate rect", () => {
      for (const [id, r] of result.fileRects) {
        expect(r.w, `w for ${id}`).toBeGreaterThan(0);
        expect(r.h, `h for ${id}`).toBeGreaterThan(0);
      }
    });

    it("total bounds are non-negative", () => {
      expect(result.totalBounds.w).toBeGreaterThan(0);
      expect(result.totalBounds.h).toBeGreaterThan(0);
    });

    // This is the whole point of using a treemap over the grid layout —
    // the realized aspect ratio should be reasonable (not 1:100). We
    // allow a wide tolerance because small graphs can't hit the target
    // exactly.
    it("aspect ratio within reasonable bounds", () => {
      const { w, h } = result.totalBounds;
      const aspect = w / h;
      expect(aspect).toBeGreaterThan(0.3);
      expect(aspect).toBeLessThan(5.0);
    });
  });

  describe("clusters (no drill)", () => {
    // Two top-level dirs — clusters should equal top-level dirs.
    const graph = makeGraph([
      "crates/alpha/src/a.rs",
      "crates/alpha/src/b.rs",
      "tests/t1.rs",
      "tests/t2.rs",
    ]);
    const result = treemapLayout(graph);

    it("emits one cluster per top-level directory", () => {
      // clusterSource = topLevel (len > 1) → 2 clusters.
      expect(result.clusters.length).toBe(2);
      const ids = new Set(result.clusters.map(c => c.id));
      expect(ids.has("crates")).toBe(true);
      expect(ids.has("tests")).toBe(true);
    });

    it("cluster fileCount sums correctly", () => {
      const total = result.clusters.reduce((s, c) => s + c.fileCount, 0);
      expect(total).toBe(4);
    });

    it("every cluster has a rect", () => {
      for (const c of result.clusters) {
        expect(c.rect.w).toBeGreaterThan(0);
        expect(c.rect.h).toBeGreaterThan(0);
      }
    });
  });

  describe("clusters (single-dominant drill)", () => {
    // One dominant top-level ("crates") with > 90% of files → drill
    // into its children.
    const ids: string[] = [];
    for (let i = 0; i < 30; i++) ids.push(`crates/alpha/src/a${i}.rs`);
    for (let i = 0; i < 30; i++) ids.push(`crates/beta/src/b${i}.rs`);
    for (let i = 0; i < 30; i++) ids.push(`crates/gamma/src/c${i}.rs`);
    // Add one file under a different top-level; keeps < 10% of total.
    ids.push("tools/t.rs");
    const graph = makeGraph(ids);
    const result = treemapLayout(graph);

    it("drills into the dominant top-level when topLevel.length === 1", () => {
      // topLevel = [crates, tools] — not single, but `crates` dominates.
      // Should drill past `crates` → emit [alpha, beta, gamma] clusters.
      const clusterIds = result.clusters.map(c => c.id).sort();
      expect(clusterIds).toEqual(["crates/alpha", "crates/beta", "crates/gamma"]);
    });
  });

  describe("clusters (single top-level drill)", () => {
    // Exactly one top-level ("crates") → always drills.
    const graph = makeGraph([
      "crates/alpha/src/a.rs",
      "crates/alpha/src/b.rs",
      "crates/beta/src/c.rs",
    ]);
    const result = treemapLayout(graph);

    it("drills into the single top-level into its children", () => {
      const ids = result.clusters.map(c => c.id).sort();
      expect(ids).toEqual(["crates/alpha", "crates/beta"]);
    });
  });

  describe("superclusters", () => {
    // Superclusters = one tier above clusters (parents of clusters).
    it("for multi-top-level graphs matches top-level dirs", () => {
      const graph = makeGraph([
        "crates/alpha/src/a.rs",
        "tests/t1.rs",
      ]);
      const result = treemapLayout(graph);
      // superclusterSource = topLevel → 2 boxes.
      expect(result.superclusters.length).toBe(2);
    });

    it("for single-dominant-drill case uses cluster parents", () => {
      const ids: string[] = [];
      for (let i = 0; i < 50; i++) ids.push(`services/a/src/a${i}.rs`);
      const graph = makeGraph(ids);
      const result = treemapLayout(graph);
      // topLevel = [services] (length 1) → drilled into "services" for
      // clusters. Supercluster logic detects that, and emits children
      // of the drilled-into dir ("services/a").
      expect(result.superclusters.length).toBeGreaterThanOrEqual(1);
    });
  });

  describe("flat layout (no directories)", () => {
    // All files at the root. buildDirTree will put them on root.files
    // directly; squarify will wrap them in a single __files__ leaf.
    const graph = makeGraph(["a.rs", "b.rs", "c.rs"]);
    const result = treemapLayout(graph);

    it("preserves file count", () => {
      expect(result.fileRects.size).toBe(3);
    });

    it("emits no clusters for fully-flat layout", () => {
      // topLevel is empty because the only "child" is __files__ which we
      // filter out. Expect no clusters.
      expect(result.clusters.length).toBe(0);
    });
  });

  describe("file rects inside their cluster rect", () => {
    // Every file in a cluster should have a rect fully contained inside
    // that cluster's bounding rect. This is what lets the spatial query
    // at supergalaxy LOD just filter clusters and know the interior files
    // are represented.
    const graph = makeGraph([
      "crates/alpha/src/a.rs",
      "crates/alpha/src/b.rs",
      "tests/t1.rs",
    ]);
    const result = treemapLayout(graph);

    it("file rects fall within cluster bounds", () => {
      for (const [fid, rect] of result.fileRects) {
        const clusterId = fid.split("/")[0];
        const cluster = result.clusters.find(c => c.id === clusterId);
        if (!cluster) continue;
        expect(rect.x, `${fid} x`).toBeGreaterThanOrEqual(cluster.rect.x - 0.01);
        expect(rect.y, `${fid} y`).toBeGreaterThanOrEqual(cluster.rect.y - 0.01);
        expect(rect.x + rect.w, `${fid} x+w`).toBeLessThanOrEqual(cluster.rect.x + cluster.rect.w + 0.01);
        expect(rect.y + rect.h, `${fid} y+h`).toBeLessThanOrEqual(cluster.rect.y + cluster.rect.h + 0.01);
      }
    });
  });
});
