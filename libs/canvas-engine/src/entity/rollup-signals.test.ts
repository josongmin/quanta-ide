import { describe, it, expect } from "vitest";
import type { FileNode, WorkspaceGraph } from "../graph/types";
import { buildEntityTree } from "./build-entity-tree";
import { rollupEntitySignals } from "./rollup-signals";

function mkFile(
  id: string,
  loc: number,
  risk: number,
  signals: Partial<FileNode["signals"]> = {},
): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "domain",
    riskScore: risk,
    loc,
    signals: {
      taintCount: signals.taintCount ?? 0,
      blastCritical: signals.blastCritical ?? 0,
      deadCount: signals.deadCount ?? 0,
      archViolations: signals.archViolations ?? 0,
      cpxMax: signals.cpxMax ?? 0,
    },
    functions: [],
  };
}

describe("rollupEntitySignals", () => {
  it("leaf (building) takes values straight from the FileNode", () => {
    const tree = buildEntityTree({
      files: [mkFile("pkg/x.ts", 100, 80, { taintCount: 2, archViolations: 1 })],
      fileEdges: [],
      comments: [],
    } as WorkspaceGraph);
    const rollup = rollupEntitySignals(tree, {
      files: [mkFile("pkg/x.ts", 100, 80, { taintCount: 2, archViolations: 1 })],
      fileEdges: [],
      comments: [],
    } as WorkspaceGraph);
    const building = tree.byKind("building")[0]!;
    const s = rollup.get(building.id)!;
    expect(s.riskMax).toBe(80);
    expect(s.taintCount).toBe(2);
    expect(s.archViolations).toBe(1);
    expect(s.fileCount).toBe(1);
    expect(s.locSum).toBe(100);
  });

  it("ancestor riskMax surfaces the single worst file", () => {
    const graph = {
      files: [
        mkFile("pkg/safe.ts", 100, 10),
        mkFile("pkg/hot.ts", 20, 95),
        mkFile("pkg/cool.ts", 40, 30),
      ],
      fileEdges: [],
      comments: [],
    } as WorkspaceGraph;
    const tree = buildEntityTree(graph);
    const rollup = rollupEntitySignals(tree, graph);
    const galaxy = tree.byKind("galaxy")[0]!;
    expect(rollup.get(galaxy.id)!.riskMax).toBe(95);
  });

  it("ancestor sums count-type signals across descendants", () => {
    const graph = {
      files: [
        mkFile("pkg/a.ts", 50, 20, { taintCount: 3, deadCount: 1 }),
        mkFile("pkg/sub/b.ts", 30, 40, { taintCount: 2, archViolations: 1 }),
      ],
      fileEdges: [],
      comments: [],
    } as WorkspaceGraph;
    const tree = buildEntityTree(graph);
    const rollup = rollupEntitySignals(tree, graph);
    const galaxy = tree.byKind("galaxy")[0]!;
    const s = rollup.get(galaxy.id)!;
    expect(s.taintCount).toBe(5);
    expect(s.deadCount).toBe(1);
    expect(s.archViolations).toBe(1);
    expect(s.fileCount).toBe(2);
  });

  it("empty graph returns only the root with zeros", () => {
    const tree = buildEntityTree({ files: [], fileEdges: [], comments: [] });
    const rollup = rollupEntitySignals(tree, { files: [], fileEdges: [], comments: [] });
    const root = rollup.get(tree.rootId)!;
    expect(root.fileCount).toBe(0);
    expect(root.riskMax).toBe(0);
  });
});
