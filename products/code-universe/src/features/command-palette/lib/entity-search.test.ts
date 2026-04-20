import { describe, it, expect } from "vitest";
import type { WorkspaceGraph, FileNode } from "@quanta/canvas-engine";
import { buildEntityTree } from "@quanta/canvas-engine";
import { searchEntities } from "./entity-search";

function mkFile(id: string): FileNode {
  return {
    id,
    name: id.split("/").pop() ?? id,
    layer: "domain",
    riskScore: 0,
    loc: 1,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
  };
}

function mkGraph(...files: FileNode[]): WorkspaceGraph {
  return { files, fileEdges: [], comments: [] };
}

describe("searchEntities", () => {
  it("returns [] for empty query or null tree", () => {
    expect(searchEntities(null, "foo")).toEqual([]);
    const tree = buildEntityTree(mkGraph(mkFile("pkg/a.ts")));
    expect(searchEntities(tree, "")).toEqual([]);
    expect(searchEntities(tree, "   ")).toEqual([]);
  });

  it("ranks exact name match highest", () => {
    const tree = buildEntityTree(
      mkGraph(mkFile("pkg/Button.tsx"), mkFile("pkg/ButtonGroup.tsx")),
    );
    const results = searchEntities(tree, "Button.tsx");
    expect(results[0]?.entity.name).toBe("Button.tsx");
  });

  it("shorter name wins on tied scores", () => {
    const tree = buildEntityTree(
      mkGraph(mkFile("pkg/Button.tsx"), mkFile("pkg/ButtonGroup.tsx")),
    );
    const results = searchEntities(tree, "button");
    expect(results[0]?.entity.name).toBe("Button.tsx");
    expect(results[1]?.entity.name).toBe("ButtonGroup.tsx");
  });

  it("exact name match wins — an ancestor galaxy over a prefixed file", () => {
    // Package "shell" exact-matches the query; file "shell.ts" only
    // prefixes. Exact > prefix by a wide margin, so the galaxy wins
    // regardless of the building kind bonus.
    const tree = buildEntityTree(mkGraph(mkFile("shell/shell.ts")));
    const results = searchEntities(tree, "shell");
    expect(results[0]?.entity.kind).toBe("galaxy");
    expect(results[1]?.entity.kind).toBe("building");
  });

  it("kind bonus breaks ties among same-score matches", () => {
    // Two entities both name-CONTAIN the query but neither is an
    // exact match or prefix. The building (higher kind bonus) wins.
    const tree = buildEntityTree(
      mkGraph(mkFile("mystuff/fooBar.ts"), mkFile("barFoobar/plain.ts")),
    );
    const results = searchEntities(tree, "foobar");
    // Both have name.includes("foobar") → same base 200. Kind bonus
    // promotes the building over the galaxy.
    expect(results[0]?.entity.kind).toBe("building");
  });

  it("includes path matches when name doesn't match", () => {
    const tree = buildEntityTree(mkGraph(mkFile("auth-service/handler.ts")));
    const results = searchEntities(tree, "auth");
    // "handler.ts" in "auth-service/" — path match should still find it.
    const names = results.map(r => r.entity.name);
    expect(names).toContain("handler.ts");
  });

  it("respects limit", () => {
    const files = Array.from({ length: 25 }, (_, i) => mkFile(`pkg/item-${i}.ts`));
    const tree = buildEntityTree(mkGraph(...files));
    const results = searchEntities(tree, "item", 5);
    expect(results).toHaveLength(5);
  });
});
