import { describe, it, expect } from "vitest";
import type { WorkspaceGraph, FileNode } from "@quanta/canvas-engine";
import { buildEntityTree } from "@quanta/canvas-engine";
import { makeWeightFn } from "./store";

function mkFile(id: string, loc: number, risk: number): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "domain",
    riskScore: risk,
    loc,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
  };
}

describe("makeWeightFn", () => {
  it("loc mode reflects LoC at leaves and sums at ancestors", () => {
    const tree = buildEntityTree(
      {
        files: [mkFile("pkg/a.ts", 100, 10), mkFile("pkg/b.ts", 50, 30)],
        fileEdges: [],
        comments: [],
      } as WorkspaceGraph,
    );
    const w = makeWeightFn(tree, "loc");
    const byKind = tree.byKind("building");
    const a = byKind.find(b => b.name === "a.ts");
    const b = byKind.find(b => b.name === "b.ts");
    expect(a && w(a.id)).toBe(100);
    expect(b && w(b.id)).toBe(50);
    const galaxy = tree.byKind("galaxy")[0];
    // Galaxy rolls up to at least 100 + 50 = 150 (plus its own leafValue).
    expect(galaxy && w(galaxy.id)).toBeGreaterThanOrEqual(150);
  });

  it("risk mode pushes hotspots even when loc is small", () => {
    const tree = buildEntityTree({
      files: [mkFile("pkg/tiny-hotspot.ts", 10, 95), mkFile("pkg/big-safe.ts", 500, 5)],
      fileEdges: [],
      comments: [],
    } as WorkspaceGraph);
    const wRisk = makeWeightFn(tree, "risk");
    const tiny = tree.byKind("building").find(b => b.name === "tiny-hotspot.ts");
    const big = tree.byKind("building").find(b => b.name === "big-safe.ts");
    expect(tiny && big).toBeTruthy();
    // risk 95 > risk 5 regardless of loc
    expect(wRisk(tiny!.id)).toBeGreaterThan(wRisk(big!.id));
  });

  it("equal mode flattens weights to 1 per leaf", () => {
    const tree = buildEntityTree({
      files: [mkFile("pkg/a.ts", 10, 10), mkFile("pkg/b.ts", 999, 90)],
      fileEdges: [],
      comments: [],
    } as WorkspaceGraph);
    const w = makeWeightFn(tree, "equal");
    const a = tree.byKind("building").find(b => b.name === "a.ts");
    const b = tree.byKind("building").find(b => b.name === "b.ts");
    expect(a && w(a.id)).toBe(1);
    expect(b && w(b.id)).toBe(1);
  });

  it("never returns zero (even zero-metric entities pack sanely)", () => {
    const tree = buildEntityTree({
      files: [mkFile("pkg/x.ts", 0, 0)],
      fileEdges: [],
      comments: [],
    } as WorkspaceGraph);
    const wLoc = makeWeightFn(tree, "loc");
    const wRisk = makeWeightFn(tree, "risk");
    for (const e of tree.byId.values()) {
      expect(wLoc(e.id)).toBeGreaterThan(0);
      expect(wRisk(e.id)).toBeGreaterThan(0);
    }
  });
});
