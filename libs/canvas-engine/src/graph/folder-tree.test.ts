import { describe, it, expect } from "vitest";
import type { FileNode, Rect } from "./types";
import {
  buildFolderTree,
  fillFolderCenters,
  ancestorsFromRoot,
  lcaOf,
} from "./folder-tree";

function f(id: string): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "util",
    riskScore: 0,
    loc: 10,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
  };
}

describe("folder-tree", () => {
  it("builds nested folder hierarchy from paths", () => {
    const tree = buildFolderTree([
      f("src/a/x.ts"),
      f("src/a/y.ts"),
      f("src/b/z.ts"),
      f("root.ts"),
    ]);

    // Expect: "" (root) → src → (a, b); root has file "root.ts"
    expect(tree.byPath.get("")).toBeDefined();
    expect(tree.byPath.get("src")).toBeDefined();
    expect(tree.byPath.get("src/a")).toBeDefined();
    expect(tree.byPath.get("src/b")).toBeDefined();

    expect(tree.root.fileIds).toEqual(["root.ts"]);
    expect(tree.byPath.get("src/a")!.fileIds.sort()).toEqual(["src/a/x.ts", "src/a/y.ts"]);
    expect(tree.byPath.get("src/b")!.fileIds).toEqual(["src/b/z.ts"]);

    // Depth
    expect(tree.root.depth).toBe(0);
    expect(tree.byPath.get("src")!.depth).toBe(1);
    expect(tree.byPath.get("src/a")!.depth).toBe(2);
  });

  it("LCA picks the correct common ancestor across branches", () => {
    const tree = buildFolderTree([
      f("src/a/x.ts"),
      f("src/a/y.ts"),
      f("src/b/z.ts"),
      f("pkg/q.ts"),
    ]);
    const a = tree.fileFolder.get("src/a/x.ts")!;
    const b = tree.fileFolder.get("src/a/y.ts")!;
    const c = tree.fileFolder.get("src/b/z.ts")!;
    const d = tree.fileFolder.get("pkg/q.ts")!;

    expect(lcaOf(a, b).path).toBe("src/a");     // siblings in same folder
    expect(lcaOf(a, c).path).toBe("src");       // cousins under src
    expect(lcaOf(a, d).path).toBe("");          // root
  });

  it("ancestorsFromRoot returns root-first chain", () => {
    const tree = buildFolderTree([f("a/b/c/d.ts")]);
    const leaf = tree.fileFolder.get("a/b/c/d.ts")!;
    const chain = ancestorsFromRoot(leaf).map(n => n.path);
    expect(chain).toEqual(["", "a", "a/b", "a/b/c"]);
  });

  it("fillFolderCenters computes bbox centers bottom-up", () => {
    const tree = buildFolderTree([
      f("src/a/x.ts"),
      f("src/a/y.ts"),
    ]);
    const rects = new Map<string, Rect>([
      ["src/a/x.ts", { x: 0, y: 0, w: 10, h: 10 }],
      ["src/a/y.ts", { x: 90, y: 90, w: 10, h: 10 }],
    ]);
    fillFolderCenters(tree, rects);

    const srcA = tree.byPath.get("src/a")!;
    // bbox = (0,0)..(100,100); center = (50,50)
    expect(srcA.center).toEqual({ x: 50, y: 50 });

    // Parent propagates: src wraps src/a which wraps both files.
    expect(tree.byPath.get("src")!.center).toEqual({ x: 50, y: 50 });
  });

  it("folders with no descendants have undefined center", () => {
    const tree = buildFolderTree([f("src/a/x.ts")]);
    // No rect for src/a/x.ts provided; fillFolderCenters should leave centers undefined.
    fillFolderCenters(tree, new Map());
    expect(tree.byPath.get("src/a")!.center).toBeUndefined();
  });
});
