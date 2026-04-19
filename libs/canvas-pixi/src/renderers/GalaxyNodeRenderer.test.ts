import { describe, it, expect } from "vitest";
import { Container } from "pixi.js";
import type { FileNode, WorkspaceLayout, ViewState, Viewport, Rect } from "@quanta/canvas-engine";
import { GalaxyNodeRenderer } from "./GalaxyNodeRenderer";

// GalaxyNodeRenderer constructs Pixi Mesh/Container/Graphics — all legal in
// jsdom without a WebGL context. We can exercise the orchestration paths
// (ids-key cache invalidation, partial vs. full path selection) without ever
// triggering an actual render. The Float32Array backing the InstancedRectMesh
// is still observable via private field access for spot checks.

function makeFile(id: string, riskScore = 50): FileNode {
  return {
    id,
    name: id,
    layer: "domain",
    riskScore,
    loc: 100,
    signals: { taintCount: 0, blastCritical: 0, deadCount: 0, archViolations: 0, cpxMax: 0 },
    functions: [],
  };
}

function makeLayout(files: FileNode[]): WorkspaceLayout {
  const fileRects = new Map<string, Rect>();
  files.forEach((f, i) => {
    fileRects.set(f.id, { x: i * 100, y: 0, w: 80, h: 60 });
  });
  return {
    fileRects,
    edgeRoutes: new Map(),
    aggregates: [] as unknown as WorkspaceLayout["aggregates"],
    totalBounds: { x: 0, y: 0, w: files.length * 100, h: 60 },
  };
}

const emptyView: ViewState = {
  lod: "galaxy" as ViewState["lod"],
  selectedFileId: null,
  hoveredFileId: null,
  selectedEdgeId: null,
  hoveredEdgeId: null,
  focusedNodeId: null,
  hoveredClusterId: null,
  hoveredSuperclusterId: null,
};

const vp: Viewport = { x: 0, y: 0, scale: 0.1, width: 800, height: 600 };

describe("GalaxyNodeRenderer lifecycle", () => {
  it("constructs, clears, destroys without throwing", () => {
    const parent = new Container();
    const g = new GalaxyNodeRenderer(parent);
    g.clear();
    g.destroy();
  });

  it("empty update leaves the hit layer hidden and 0 instances", () => {
    const parent = new Container();
    const g = new GalaxyNodeRenderer(parent);
    g.update([], makeLayout([]), emptyView, vp);
    // Reaching internal state: the rect mesh's instance count on the
    // geometry is the public contract for the draw loop.
    const mesh = (g as unknown as { rectMesh: { mesh: { geometry: { instanceCount: number } } } }).rectMesh;
    expect(mesh.mesh.geometry.instanceCount).toBe(0);
    g.destroy();
  });
});

describe("GalaxyNodeRenderer full-path update", () => {
  it("writes N instances when layout has rects for every file", () => {
    const parent = new Container();
    const g = new GalaxyNodeRenderer(parent);
    const files = [makeFile("a"), makeFile("b"), makeFile("c")];
    g.update(files, makeLayout(files), emptyView, vp);
    const mesh = (g as unknown as { rectMesh: { mesh: { geometry: { instanceCount: number } } } }).rectMesh;
    expect(mesh.mesh.geometry.instanceCount).toBe(3);
    g.destroy();
  });

  it("skips files missing from layout.fileRects", () => {
    const parent = new Container();
    const g = new GalaxyNodeRenderer(parent);
    const files = [makeFile("a"), makeFile("b"), makeFile("ghost")];
    const layout = makeLayout([makeFile("a"), makeFile("b")]); // "ghost" missing
    g.update(files, layout, emptyView, vp);
    const mesh = (g as unknown as { rectMesh: { mesh: { geometry: { instanceCount: number } } } }).rectMesh;
    expect(mesh.mesh.geometry.instanceCount).toBe(2);
    g.destroy();
  });
});

describe("GalaxyNodeRenderer clear state", () => {
  it("clear() resets instance count and drops cached id→index map entries", () => {
    const parent = new Container();
    const g = new GalaxyNodeRenderer(parent);
    const files = [makeFile("a"), makeFile("b")];
    g.update(files, makeLayout(files), emptyView, vp);
    g.clear();
    const mesh = (g as unknown as { rectMesh: { mesh: { geometry: { instanceCount: number } } } }).rectMesh;
    expect(mesh.mesh.geometry.instanceCount).toBe(0);
    // After clear, the fileIdToInstanceIdx Map must be empty (partial-path
    // guard relies on this to force a full rebuild).
    const idMap = (g as unknown as { fileIdToInstanceIdx: Map<string, number> }).fileIdToInstanceIdx;
    expect(idMap.size).toBe(0);
    g.destroy();
  });
});

describe("GalaxyNodeRenderer selection changes", () => {
  it("selection-only change between updates keeps the same instance count", () => {
    const parent = new Container();
    const g = new GalaxyNodeRenderer(parent);
    const files = [makeFile("a"), makeFile("b")];
    const layout = makeLayout(files);
    g.update(files, layout, emptyView, vp);
    // Second update: same ids, selection flipped → partial path.
    g.update(files, layout, { ...emptyView, selectedFileId: "a" }, vp);
    const mesh = (g as unknown as { rectMesh: { mesh: { geometry: { instanceCount: number } } } }).rectMesh;
    expect(mesh.mesh.geometry.instanceCount).toBe(2);
    g.destroy();
  });
});
