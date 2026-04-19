import { describe, it, expect } from "vitest";
import type { WorkspaceGraph, FileNode } from "../graph/types";
import { buildEntityTree } from "../entity/build-entity-tree";
import { buildHierarchicalLayout } from "./build-hierarchical-layout";

function makeFile(id: string, loc = 10): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "domain",
    riskScore: 20,
    loc,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
  };
}

function makeGraph(...files: FileNode[]): WorkspaceGraph {
  return { files, fileEdges: [], comments: [] };
}

describe("buildHierarchicalLayout", () => {
  it("returns a root rect containing every entity rect", () => {
    const tree = buildEntityTree(
      makeGraph(makeFile("a/x.ts", 50), makeFile("a/y.ts", 30), makeFile("b/z.ts", 20)),
    );
    const layout = buildHierarchicalLayout(tree);
    const root = layout.rects.get(tree.rootId);
    expect(root).toBeDefined();
    // Every non-root entity must fit inside the root rect.
    for (const [id, r] of layout.rects) {
      if (id === tree.rootId) continue;
      expect(r.x).toBeGreaterThanOrEqual(root!.x);
      expect(r.y).toBeGreaterThanOrEqual(root!.y);
      expect(r.x + r.w).toBeLessThanOrEqual(root!.x + root!.w + 0.01);
      expect(r.y + r.h).toBeLessThanOrEqual(root!.y + root!.h + 0.01);
    }
  });

  it("rects are placed for every tree entity (no gaps)", () => {
    const tree = buildEntityTree(makeGraph(makeFile("pkg/a.ts"), makeFile("pkg/b.ts")));
    const layout = buildHierarchicalLayout(tree);
    for (const id of tree.byId.keys()) {
      expect(layout.rects.has(id)).toBe(true);
    }
  });

  it("child rects sit inside their parent rect", () => {
    const tree = buildEntityTree(
      makeGraph(makeFile("p/dir/a.ts"), makeFile("p/dir/b.ts"), makeFile("p/dir/c.ts")),
    );
    const layout = buildHierarchicalLayout(tree);
    for (const [id, entity] of tree.byId) {
      const parentRect = id === tree.rootId ? null : layout.rects.get(entity.parentId ?? "");
      const self = layout.rects.get(id);
      if (!parentRect || !self) continue;
      expect(self.x).toBeGreaterThanOrEqual(parentRect.x - 0.01);
      expect(self.y).toBeGreaterThanOrEqual(parentRect.y - 0.01);
      expect(self.x + self.w).toBeLessThanOrEqual(parentRect.x + parentRect.w + 0.01);
      expect(self.y + self.h).toBeLessThanOrEqual(parentRect.y + parentRect.h + 0.01);
    }
  });

  it("bigger files take proportionally more area within their parent", () => {
    const tree = buildEntityTree(makeGraph(makeFile("p/tiny.ts", 10), makeFile("p/big.ts", 1000)));
    const layout = buildHierarchicalLayout(tree);
    const tinyRect = [...layout.rects.entries()].find(([id]) => id.endsWith("tiny.ts"))?.[1];
    const bigRect = [...layout.rects.entries()].find(([id]) => id.endsWith("big.ts"))?.[1];
    expect(tinyRect && bigRect).toBeTruthy();
    const tinyArea = tinyRect!.w * tinyRect!.h;
    const bigArea = bigRect!.w * bigRect!.h;
    // Big file is 100× the loc — its area should dominate by a large margin.
    expect(bigArea).toBeGreaterThan(tinyArea * 10);
  });

  it("handles empty graph without crashing", () => {
    const tree = buildEntityTree(makeGraph());
    const layout = buildHierarchicalLayout(tree);
    expect(layout.rects.size).toBe(1); // just the universe root
    expect(layout.totalBounds.w).toBeGreaterThan(0);
    expect(layout.totalBounds.h).toBeGreaterThan(0);
  });
});
