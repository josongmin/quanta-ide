import { describe, it, expect } from "vitest";
import type { FileEdge, Rect } from "@quanta/canvas-engine";
import {
  collapseParallelEdges,
  bundleByFolder,
  bundleWidthMultiplier,
  folderPrefix,
} from "./edge-bundling";

// Helper — terse edge factory so the test bodies stay focused on the
// bundling behaviour rather than edge shape boilerplate.
function e(from: string, to: string, overrides: Partial<FileEdge> = {}): FileEdge {
  return {
    id: `${from}->${to}`,
    from,
    to,
    kind: "call",
    layer: "structural",
    weight: 1,
    ...overrides,
  };
}

describe("collapseParallelEdges", () => {
  it("merges same-(src,dst) pairs and sums weights", () => {
    const edges = [
      e("a.ts", "b.ts", { weight: 2, kind: "call" }),
      e("a.ts", "b.ts", { weight: 3, kind: "call" }),
      e("a.ts", "b.ts", { weight: 1, kind: "reference" }),
    ];
    const out = collapseParallelEdges(edges);
    expect(out).toHaveLength(1);
    expect(out[0].bundleCount).toBe(3);
    expect(out[0].weightSum).toBe(6);
    // dominant kind = "call" (2 vs 1)
    expect(out[0].kind).toBe("call");
  });

  it("keeps opposing directions as separate bundles", () => {
    const edges = [e("a.ts", "b.ts"), e("b.ts", "a.ts")];
    const out = collapseParallelEdges(edges);
    expect(out).toHaveLength(2);
  });

  it("passes through single edges unchanged in count", () => {
    const edges = [e("a.ts", "b.ts"), e("c.ts", "d.ts")];
    const out = collapseParallelEdges(edges);
    expect(out).toHaveLength(2);
    expect(out.every(b => b.bundleCount === 1)).toBe(true);
  });

  it("picks the max severity across merged edges", () => {
    const edges = [
      e("a.ts", "b.ts", { severity: "low" }),
      e("a.ts", "b.ts", { severity: "critical" }),
      e("a.ts", "b.ts", { severity: "medium" }),
    ];
    const out = collapseParallelEdges(edges);
    expect(out[0].severity).toBe("critical");
  });

  it("marks bundle animated if any underlying edge is animated", () => {
    const edges = [
      e("a.ts", "b.ts", { animated: false }),
      e("a.ts", "b.ts", { animated: true }),
    ];
    const out = collapseParallelEdges(edges);
    expect(out[0].animated).toBe(true);
  });
});

describe("bundleByFolder", () => {
  const rect = (x: number, y: number): Rect => ({ x, y, w: 10, h: 10 });
  const rects = new Map<string, Rect>([
    ["src/auth/login.ts", rect(0, 0)],
    ["src/auth/token.ts", rect(20, 0)],
    ["src/api/user.ts", rect(100, 100)],
    ["src/api/post.ts", rect(120, 100)],
    ["src/db/pool.ts", rect(200, 200)],
  ]);

  it("collapses cross-folder edges into one bundle per folder pair", () => {
    // 3 edges from auth → api, 1 edge from auth → db, 1 within auth
    const edges = [
      e("src/auth/login.ts", "src/api/user.ts"),
      e("src/auth/token.ts", "src/api/post.ts"),
      e("src/auth/login.ts", "src/api/post.ts"),
      e("src/auth/login.ts", "src/db/pool.ts"),
      e("src/auth/login.ts", "src/auth/token.ts"), // intra-folder, dropped
    ];
    const { bundles, folderCenters } = bundleByFolder(edges, rects, 3);
    // Expected: auth→api (count 3), auth→db (count 1). Intra auth dropped.
    expect(bundles).toHaveLength(2);
    const authApi = bundles.find(b => b.id.includes("auth") && b.id.includes("api"));
    expect(authApi?.bundleCount).toBe(3);
    // folder centres are averages of file-rect centres.
    expect(folderCenters.get("src/auth")).toBeDefined();
    expect(folderCenters.get("src/api")).toBeDefined();
    expect(folderCenters.get("src/db")).toBeDefined();
  });

  it("limits folder depth so deep paths still bundle usefully", () => {
    expect(folderPrefix("src/features/canvas/renderer/edge/foo.ts", 3)).toBe("src/features/canvas");
    expect(folderPrefix("src/features/foo.ts", 3)).toBe("src/features");
    expect(folderPrefix("foo.ts", 3)).toBe("");
  });

  it("drops intra-folder edges entirely from the output", () => {
    const edges = [
      e("src/auth/login.ts", "src/auth/token.ts"),
      e("src/auth/token.ts", "src/auth/login.ts"),
    ];
    const { bundles } = bundleByFolder(edges, rects, 3);
    expect(bundles).toHaveLength(0);
  });
});

describe("bundleWidthMultiplier", () => {
  it("returns 1 for single edges", () => {
    expect(bundleWidthMultiplier(1)).toBe(1);
    expect(bundleWidthMultiplier(0)).toBe(1);
  });

  it("grows logarithmically rather than linearly", () => {
    const w1 = bundleWidthMultiplier(1);
    const w10 = bundleWidthMultiplier(10);
    const w100 = bundleWidthMultiplier(100);
    // 10× count should NOT be 10× width — log-scaled means ~3×
    expect(w10 / w1).toBeLessThan(4);
    // 100-edge bundle sits in a sane range — well under a linear blow-up
    expect(w100).toBeLessThan(8);
    expect(w100).toBeGreaterThan(w10);
  });
});
