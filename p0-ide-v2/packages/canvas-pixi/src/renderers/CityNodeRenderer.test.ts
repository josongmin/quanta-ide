import { describe, it, expect, vi } from "vitest";
import type { FileNode, WorkspaceLayout, ViewState, Viewport, Rect } from "@quanta/canvas-engine";

// CityNodeRenderer's constructor calls `installCityFonts()` which in turn
// calls Pixi's `BitmapFont.install` — that requires an active renderer.
// We mock the font atlas to a no-op so we can construct the renderer and
// exercise its pure logic paths without a live WebGL context.
//
// Rationale for mocking this single module: it's a one-liner side-effect
// function, and the renderer never dereferences the actual font objects at
// construction time (BitmapText is only acquired during update() with a live
// frame). Mocking it keeps the test surface narrow.
vi.mock("./shared/BitmapFontAtlas", () => ({
  CITY_FONT_NAME: "quanta-city",
  CITY_FONT_BOLD_NAME: "quanta-city-bold",
  CITY_MONO_FONT_NAME: "quanta-city-mono",
  installCityFonts: () => { /* no-op — Pixi BitmapFont needs a renderer */ },
}));

// Load AFTER the mock is registered so the constructor side-effect sees the
// stub. Dynamic import keeps this ordering explicit.
const { Container } = await import("pixi.js");
const { CityNodeRenderer } = await import("./CityNodeRenderer");

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
    fileRects.set(f.id, { x: i * 200, y: 0, w: 180, h: 120 });
  });
  return {
    fileRects,
    edgeRoutes: new Map(),
    aggregates: [] as unknown as WorkspaceLayout["aggregates"],
    totalBounds: { x: 0, y: 0, w: files.length * 200, h: 120 },
  };
}

const emptyView: ViewState = {
  lod: "city" as ViewState["lod"],
  selectedFileId: null,
  hoveredFileId: null,
  selectedEdgeId: null,
  hoveredEdgeId: null,
  focusedNodeId: null,
};

// Below LABEL_MIN_SCREEN_SCALE (0.25) to keep label acquisition off the hot
// path — that branch pulls BitmapText, which we don't want to exercise.
const labelsOffVp: Viewport = { x: 0, y: 0, scale: 0.1, width: 800, height: 600 };

describe("CityNodeRenderer lifecycle", () => {
  it("constructs, clears, destroys without throwing", () => {
    const parent = new Container();
    const c = new CityNodeRenderer(parent);
    c.clear();
    c.destroy();
  });

  it("empty update leaves 0 instances and no pickRects", () => {
    const parent = new Container();
    const c = new CityNodeRenderer(parent);
    c.update([], makeLayout([]), emptyView, labelsOffVp);
    const mesh = (c as unknown as { rectMesh: { mesh: { geometry: { instanceCount: number } } } }).rectMesh;
    expect(mesh.mesh.geometry.instanceCount).toBe(0);
    const picks = (c as unknown as { pickRects: unknown[] }).pickRects;
    expect(picks).toHaveLength(0);
    c.destroy();
  });
});

describe("CityNodeRenderer update — rects-only (labels hidden)", () => {
  it("writes card shell + header per file (2 rects) when no functions", () => {
    const parent = new Container();
    const c = new CityNodeRenderer(parent);
    const files = [makeFile("a"), makeFile("b")];
    c.update(files, makeLayout(files), emptyView, labelsOffVp);
    const mesh = (c as unknown as { rectMesh: { mesh: { geometry: { instanceCount: number } } } }).rectMesh;
    // 2 files × (card shell + header) = 4; no function blocks because
    // file.functions is empty.
    expect(mesh.mesh.geometry.instanceCount).toBe(4);
    c.destroy();
  });

  it("tracks pickRects per visible file (one per file, card-sized)", () => {
    const parent = new Container();
    const c = new CityNodeRenderer(parent);
    const files = [makeFile("a"), makeFile("b"), makeFile("c")];
    c.update(files, makeLayout(files), emptyView, labelsOffVp);
    const picks = (c as unknown as { pickRects: Array<{ id: string }> }).pickRects;
    expect(picks.map(p => p.id)).toEqual(["a", "b", "c"]);
    c.destroy();
  });

  it("skips files missing from layout.fileRects", () => {
    const parent = new Container();
    const c = new CityNodeRenderer(parent);
    const files = [makeFile("a"), makeFile("ghost")];
    const layout = makeLayout([makeFile("a")]); // ghost has no rect
    c.update(files, layout, emptyView, labelsOffVp);
    const picks = (c as unknown as { pickRects: Array<{ id: string }> }).pickRects;
    expect(picks.map(p => p.id)).toEqual(["a"]);
    c.destroy();
  });
});

describe("CityNodeRenderer.clear", () => {
  it("drops pickRects, label cache, and zeroes instance count", () => {
    const parent = new Container();
    const c = new CityNodeRenderer(parent);
    const files = [makeFile("a")];
    c.update(files, makeLayout(files), emptyView, labelsOffVp);
    c.clear();
    const mesh = (c as unknown as { rectMesh: { mesh: { geometry: { instanceCount: number } } } }).rectMesh;
    expect(mesh.mesh.geometry.instanceCount).toBe(0);
    const picks = (c as unknown as { pickRects: unknown[] }).pickRects;
    expect(picks).toHaveLength(0);
    const labelCache = (c as unknown as { labelCache: Map<string, unknown> }).labelCache;
    expect(labelCache.size).toBe(0);
    c.destroy();
  });
});
