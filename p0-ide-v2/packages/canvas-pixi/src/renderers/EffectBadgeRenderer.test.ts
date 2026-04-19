import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Container, Graphics } from "pixi.js";
import { EffectBadgeRenderer, setBadgesMeshEnabled } from "./EffectBadgeRenderer";
import type {
  FileNode,
  WorkspaceLayout,
  Viewport,
  Rect,
  LodLevel,
  FileEffects,
} from "@quanta/canvas-engine";

// The tests below spy on the private `gfx: Graphics` field's `roundRect()`
// method to assert branch coverage. The SOTA instanced-mesh chip path
// routes chip backgrounds through an InstancedCircleMesh instead of
// Graphics, which would zero-out those spy counts. We disable the mesh
// path for this test file so the assertions continue to target the
// Graphics fallback — a live-code sanity check that the rollback path
// still draws correct geometry.
beforeEach(() => {
  setBadgesMeshEnabled(false);
});
afterEach(() => {
  setBadgesMeshEnabled(true);
});

// Coverage notes
// ---------------
// `build()` branches:
//   1. effects argument missing / undefined → clear path, no draw
//   2. LOD is coarse (galaxy / supergalaxy / universe) → tierAllows false
//   3. LOD allowed + one file with ≥1 effect → chip row drawn
//   4. file with zero effects → skipped (entry.effects.length === 0)
//   5. file missing from layout.fileRects → skipped (rect === undefined)
//   6. rebuild with identical hash → short-circuit (no extra roundRect)
//
// `drawRow` constructs Pixi Text and reads `label.width`. In jsdom the
// Text CanvasTextMetrics call path throws when it tries to measure glyph
// runs — so we stub the internal `textPool` with a width-bearing stub
// before any fine-LOD build() that exercises drawRow.

function makeFile(id: string): FileNode {
  return {
    id,
    name: id,
    layer: "domain",
    riskScore: 50,
    loc: 100,
    signals: {
      taintCount: 0,
      blastCritical: 0,
      deadCount: 0,
      archViolations: 0,
      cpxMax: 0,
    },
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
    aggregates: {
      commentsByFunction: new Map(),
      commentsByFile: new Map(),
      commentedLines: new Map(),
    },
    totalBounds: { x: 0, y: 0, w: files.length * 200, h: 120 },
  };
}

function installStubTextPool(r: EffectBadgeRenderer, count = 8): void {
  // Replace the internal text pool so drawRow doesn't call
  // CanvasTextMetrics (which fails in jsdom). Each stub has a numeric
  // `.width` so the alignment math runs cleanly.
  const pool = Array.from({ length: count }, () => ({
    text: "",
    visible: false,
    position: { set: () => {} },
    scale: { set: () => {} },
    width: 6,
    height: 8,
    style: { fill: 0xffffff, fontSize: 10 },
    destroy: () => {},
    eventMode: "none" as const,
  }));
  (r as unknown as { textPool: unknown[] }).textPool = pool;
}

const VP: Viewport = { x: 0, y: 0, scale: 1, width: 800, height: 600 };

function privateGfx(r: EffectBadgeRenderer): Graphics {
  return (r as unknown as { gfx: Graphics }).gfx;
}

describe("EffectBadgeRenderer", () => {
  let parent: Container;
  let renderer: EffectBadgeRenderer;

  beforeEach(() => {
    parent = new Container();
    renderer = new EffectBadgeRenderer(parent);
  });

  afterEach(() => {
    renderer.destroy();
    parent.destroy({ children: true });
  });

  it("no-op when effects argument is undefined", () => {
    const gfx = privateGfx(renderer);
    const roundRectSpy = vi.spyOn(gfx, "roundRect");
    const files = [makeFile("a.ts")];
    const layout = makeLayout(files);
    const lod: LodLevel = "street";
    renderer.build(files, undefined, layout, VP, lod);
    expect(roundRectSpy).not.toHaveBeenCalled();
  });

  it("no-op at coarse LOD (galaxy) even when effects are present", () => {
    const gfx = privateGfx(renderer);
    const roundRectSpy = vi.spyOn(gfx, "roundRect");
    const files = [makeFile("a.ts")];
    const layout = makeLayout(files);
    const effects: Record<string, FileEffects> = {
      "a.ts": { fileId: "a.ts", effects: ["db", "net"] },
    };
    const lod: LodLevel = "galaxy";
    renderer.build(files, effects, layout, VP, lod);
    expect(roundRectSpy).not.toHaveBeenCalled();
  });

  it("draws chips at street/ground LOD when the file has effects", () => {
    installStubTextPool(renderer);
    const gfx = privateGfx(renderer);
    const roundRectSpy = vi.spyOn(gfx, "roundRect");
    const files = [makeFile("a.ts")];
    const layout = makeLayout(files);
    const effects: Record<string, FileEffects> = {
      "a.ts": { fileId: "a.ts", effects: ["db", "net"] },
    };
    const lod: LodLevel = "street";
    renderer.build(files, effects, layout, VP, lod);
    // Two chips → two roundRect calls (one per effect).
    expect(roundRectSpy.mock.calls.length).toBe(2);
  });

  it("skips files with zero effects", () => {
    installStubTextPool(renderer);
    const gfx = privateGfx(renderer);
    const roundRectSpy = vi.spyOn(gfx, "roundRect");
    const files = [makeFile("a.ts"), makeFile("b.ts")];
    const layout = makeLayout(files);
    const effects: Record<string, FileEffects> = {
      "a.ts": { fileId: "a.ts", effects: [] },
      "b.ts": { fileId: "b.ts", effects: ["fs"] },
    };
    const lod: LodLevel = "street";
    renderer.build(files, effects, layout, VP, lod);
    // Only `b.ts` has chips → one roundRect.
    expect(roundRectSpy.mock.calls.length).toBe(1);
  });

  it("skips files missing from layout.fileRects", () => {
    installStubTextPool(renderer);
    const gfx = privateGfx(renderer);
    const roundRectSpy = vi.spyOn(gfx, "roundRect");
    const files = [makeFile("a.ts"), makeFile("b.ts")];
    // Only `a.ts` is in the layout; `b.ts` is effectively un-laid-out.
    const layout = makeLayout([files[0]]);
    const effects: Record<string, FileEffects> = {
      "a.ts": { fileId: "a.ts", effects: ["db"] },
      "b.ts": { fileId: "b.ts", effects: ["net"] },
    };
    const lod: LodLevel = "street";
    renderer.build(files, effects, layout, VP, lod);
    // Only the laid-out file gets a chip.
    expect(roundRectSpy.mock.calls.length).toBe(1);
  });

  it("short-circuits the second build when nothing changed (hash guard)", () => {
    installStubTextPool(renderer);
    const gfx = privateGfx(renderer);
    const roundRectSpy = vi.spyOn(gfx, "roundRect");
    const files = [makeFile("a.ts")];
    const layout = makeLayout(files);
    const effects: Record<string, FileEffects> = {
      "a.ts": { fileId: "a.ts", effects: ["db", "net"] },
    };
    const lod: LodLevel = "street";
    renderer.build(files, effects, layout, VP, lod);
    const after1 = roundRectSpy.mock.calls.length;
    // Second call with same inputs → hash match → early return.
    renderer.build(files, effects, layout, VP, lod);
    expect(roundRectSpy.mock.calls.length).toBe(after1);
  });

  it("renders an overflow '...' chip when effects.length > MAX_CHIPS", () => {
    installStubTextPool(renderer, 16);
    const gfx = privateGfx(renderer);
    const roundRectSpy = vi.spyOn(gfx, "roundRect");
    const files = [makeFile("a.ts")];
    const layout = makeLayout(files);
    const effects: Record<string, FileEffects> = {
      "a.ts": {
        fileId: "a.ts",
        effects: ["db", "io", "net", "env", "fs", "crypto"],
      },
    };
    const lod: LodLevel = "street";
    renderer.build(files, effects, layout, VP, lod);
    // MAX_CHIPS=4 → (MAX_CHIPS-1)=3 real + 1 overflow = 4 roundRects.
    expect(roundRectSpy.mock.calls.length).toBe(4);
  });

  it("clear() resets hash so the next build re-renders from scratch", () => {
    installStubTextPool(renderer);
    const gfx = privateGfx(renderer);
    const roundRectSpy = vi.spyOn(gfx, "roundRect");
    const files = [makeFile("a.ts")];
    const layout = makeLayout(files);
    const effects: Record<string, FileEffects> = {
      "a.ts": { fileId: "a.ts", effects: ["db"] },
    };
    const lod: LodLevel = "street";
    renderer.build(files, effects, layout, VP, lod);
    renderer.clear();
    const firstCount = roundRectSpy.mock.calls.length;
    // After clear, identical inputs still trigger a full redraw (hash=0).
    renderer.build(files, effects, layout, VP, lod);
    expect(roundRectSpy.mock.calls.length).toBeGreaterThan(firstCount);
  });
});
