import { describe, it, expect } from "vitest";
import type { WorkspaceGraph, FileNode, FunctionBlock } from "../graph/types";
import { buildEntityTree } from "./build-entity-tree";

function makeFile(
  id: string,
  loc = 10,
  riskScore = 20,
  functions: FunctionBlock[] = [],
): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "domain",
    riskScore,
    loc,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions,
  };
}

function fn(name: string, start: number, end: number, complexity = 1): FunctionBlock {
  return { name, startLine: start, endLine: end, signalCount: 0, complexity };
}

function makeGraph(...files: FileNode[]): WorkspaceGraph {
  return { files, fileEdges: [], comments: [] };
}

describe("buildEntityTree", () => {
  it("returns a root-only tree for an empty graph", () => {
    const tree = buildEntityTree(makeGraph(), { workspaceName: "empty" });
    expect(tree.rootId).toBe("universe:");
    expect(tree.byId.size).toBe(1);
    expect(tree.byKind("universe")).toHaveLength(1);
    expect(tree.byKind("building")).toHaveLength(0);
    expect(tree.childrenOf(tree.rootId)).toEqual([]);
  });

  it("classifies single-segment paths as galaxy → building (mono-package)", () => {
    const tree = buildEntityTree(makeGraph(makeFile("pkg-a/foo.ts")));
    expect(tree.byKind("galaxy")).toHaveLength(1);
    expect(tree.byKind("building")).toHaveLength(1);
    expect(tree.byKind("street")).toHaveLength(0);
    const galaxy = tree.byKind("galaxy")[0];
    expect(galaxy?.name).toBe("pkg-a");
    expect(galaxy?.parentId).toBe(tree.rootId);
    expect(galaxy?.childIds).toHaveLength(1);
  });

  it("classifies intermediate segments as street", () => {
    const tree = buildEntityTree(makeGraph(makeFile("pkg/src/feature/index.ts")));
    // pkg = galaxy, src + feature = street, index.ts = building
    expect(tree.byKind("galaxy")).toHaveLength(1);
    expect(tree.byKind("street")).toHaveLength(2);
    expect(tree.byKind("building")).toHaveLength(1);
  });

  it("dedupes shared ancestors across files", () => {
    const tree = buildEntityTree(
      makeGraph(
        makeFile("pkg/a.ts"),
        makeFile("pkg/b.ts"),
        makeFile("pkg/sub/c.ts"),
      ),
    );
    // One galaxy, one street ("sub"), three buildings
    expect(tree.byKind("galaxy")).toHaveLength(1);
    expect(tree.byKind("street")).toHaveLength(1);
    expect(tree.byKind("building")).toHaveLength(3);
    const galaxy = tree.byKind("galaxy")[0];
    expect(galaxy?.childIds).toHaveLength(3); // a.ts, b.ts, sub/
  });

  it("orders siblings deterministically by path", () => {
    const tree = buildEntityTree(
      makeGraph(makeFile("pkg/z.ts"), makeFile("pkg/a.ts"), makeFile("pkg/m.ts")),
    );
    const galaxy = tree.byKind("galaxy")[0];
    const childNames = (galaxy?.childIds ?? []).map(id => tree.byId.get(id)?.name);
    expect(childNames).toEqual(["a.ts", "m.ts", "z.ts"]);
  });

  it("ancestorsOf walks up to universe root", () => {
    const tree = buildEntityTree(makeGraph(makeFile("pkg/src/feature/index.ts")));
    const leaf = tree.byKind("building")[0];
    if (!leaf) throw new Error("leaf missing");
    const chain = tree.ancestorsOf(leaf.id).map(e => e.kind);
    expect(chain).toEqual(["building", "street", "street", "galaxy", "universe"]);
  });

  it("preserves file-level metrics on building entities", () => {
    const tree = buildEntityTree(makeGraph(makeFile("pkg/foo.ts", 42, 70)));
    const building = tree.byKind("building")[0];
    expect(building?.metrics?.loc).toBe(42);
    expect(building?.metrics?.riskScore).toBe(70);
    expect(building?.metrics?.fileCount).toBe(1);
  });

  it("emits a synthetic floor + rooms for files with functions", () => {
    const tree = buildEntityTree(
      makeGraph(
        makeFile("pkg/foo.ts", 100, 20, [
          fn("a", 1, 10, 2),
          fn("b", 15, 40, 5),
          fn("c", 45, 90, 3),
        ]),
      ),
    );
    expect(tree.byKind("floor")).toHaveLength(1);
    expect(tree.byKind("room")).toHaveLength(3);
    const floor = tree.byKind("floor")[0];
    expect(floor?.parentId).toBe("pkg/foo.ts");
    expect(floor?.childIds).toHaveLength(3);
  });

  it("rooms sort by source line so traversal reflects file reading order", () => {
    const tree = buildEntityTree(
      makeGraph(
        makeFile("pkg/f.ts", 60, 20, [
          fn("third", 40, 55),
          fn("first", 1, 10),
          fn("second", 15, 30),
        ]),
      ),
    );
    const floor = tree.byKind("floor")[0];
    const roomNames = (floor?.childIds ?? []).map(id => tree.byId.get(id)?.name);
    expect(roomNames).toEqual(["first", "second", "third"]);
  });

  it("room metrics derive loc from line range + riskScore from complexity", () => {
    const tree = buildEntityTree(
      makeGraph(makeFile("pkg/f.ts", 50, 10, [fn("hot", 10, 40, 8)])),
    );
    const room = tree.byKind("room")[0];
    // endLine - startLine + 1 = 31
    expect(room?.metrics?.loc).toBe(31);
    // complexity 8 * 10 = 80 (clamped to 100 max)
    expect(room?.metrics?.riskScore).toBe(80);
  });

  it("files with zero functions produce no floor/room entities", () => {
    const tree = buildEntityTree(
      makeGraph(makeFile("pkg/bare.ts"), makeFile("pkg/also-bare.ts")),
    );
    expect(tree.byKind("floor")).toHaveLength(0);
    expect(tree.byKind("room")).toHaveLength(0);
  });
});
