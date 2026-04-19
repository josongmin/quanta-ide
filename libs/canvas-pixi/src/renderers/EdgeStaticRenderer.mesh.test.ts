import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Container } from "pixi.js";
import {
  EdgeStaticRenderer,
  setEdgesMeshEnabled,
  setDecorationsMeshEnabled,
} from "./EdgeStaticRenderer";
import {
  FLOATS_PER_EDGE_INSTANCE,
  EDGE_FLAG_DASHED,
  EDGE_FLAG_VIOLATION,
  type InstancedLineMesh,
} from "./shared/InstancedLineMesh";
import type {
  FileEdge,
  WorkspaceLayout,
  Viewport,
  Rect,
  BezierRoute,
} from "@quanta/canvas-engine";

// Why this file is separate from EdgeStaticRenderer.test.ts
// ---------------------------------------------------------
// That file forces `setEdgesMeshEnabled(false)` in beforeEach because its
// assertions spy on `Graphics.stroke()` call counts — a flag that mostly
// exercises the CPU Graphics fallback. This file does the opposite:
// asserts that the instanced-line mesh buffer receives the right float
// payloads when the flag is ON (production default).
//
// What we check:
//   1. instanceCount committed at end-of-frame matches writes.
//   2. 18-slot instance layout matches the documented contract.
//   3. Overlays (violation halo / diff-added / diff-removed ghost) each
//      append their own instance row behind the body stroke.
//   4. Skip LOD blanks the mesh (instanceCount → 0).
//   5. `clear()` resets mesh state atomically.
//
// Private-field access
// --------------------
// There is no public API for the mesh buffer state (by design — the
// renderer owns it). Tests peek via string-indexed reflection so they
// can validate the invariants without widening the production surface.
// If a refactor renames the private field, these tests should break
// loudly and force a re-pin — that's the right signal.

const SAMPLE_ROUTE: BezierRoute = {
  x1: 0, y1: 0, cx1: 25, cy1: 25, cx2: 75, cy2: 75, x2: 100, y2: 100,
};

function makeLayout(): WorkspaceLayout {
  const fileRects = new Map<string, Rect>();
  // Two cards side by side so anchor math resolves to non-degenerate points.
  fileRects.set("a", { x: 0, y: 0, w: 100, h: 80 });
  fileRects.set("b", { x: 300, y: 0, w: 100, h: 80 });
  fileRects.set("c", { x: 0, y: 200, w: 100, h: 80 });
  const edgeRoutes = new Map<string, BezierRoute>();
  edgeRoutes.set("e1", SAMPLE_ROUTE);
  edgeRoutes.set("e2", SAMPLE_ROUTE);
  edgeRoutes.set("e3", SAMPLE_ROUTE);
  return {
    fileRects,
    edgeRoutes,
    aggregates: {
      commentsByFunction: new Map(),
      commentsByFile: new Map(),
      commentedLines: new Map(),
    },
    totalBounds: { x: 0, y: 0, w: 400, h: 280 },
  };
}

function makeEdge(id: string, from: string, to: string, overrides: Partial<FileEdge> = {}): FileEdge {
  return {
    id, from, to,
    kind: "call",
    layer: "structural",
    weight: 1,
    ...overrides,
  };
}

const VP: Viewport = { x: 0, y: 0, scale: 1, width: 800, height: 600 };

// Reflection helpers — single source for private-field access in this file.
function getMesh(r: EdgeStaticRenderer): InstancedLineMesh {
  return (r as unknown as { lineMesh: InstancedLineMesh }).lineMesh;
}
function getInstanceCount(r: EdgeStaticRenderer): number {
  return getMesh(r).mesh.geometry.instanceCount;
}
function getMeshCounter(r: EdgeStaticRenderer): number {
  return (r as unknown as { meshInstanceCount: number }).meshInstanceCount;
}

describe("EdgeStaticRenderer — mesh body + overlays", () => {
  let parent: Container;
  let renderer: EdgeStaticRenderer;

  beforeEach(() => {
    // Run the mesh path (production default) but keep the decoration-mesh
    // path off so arrow/glow/x-cap decorations don't inflate the instance
    // count we're asserting on.
    setEdgesMeshEnabled(true);
    setDecorationsMeshEnabled(false);
    parent = new Container();
    renderer = new EdgeStaticRenderer(parent);
  });

  afterEach(() => {
    renderer.destroy();
    parent.destroy({ children: true });
    setDecorationsMeshEnabled(true);
  });

  it("commits the per-frame meshInstanceCount to geometry.instanceCount", () => {
    renderer.build(
      [makeEdge("e1", "a", "b"), makeEdge("e2", "a", "c")],
      makeLayout(), undefined, VP,
      { lod: "ground" },
    );
    // After redraw, the geometry's committed count must equal the writer's
    // counter AT END OF redraw. No uncommitted writes.
    expect(getInstanceCount(renderer)).toBe(getMeshCounter(renderer));
    expect(getInstanceCount(renderer)).toBeGreaterThanOrEqual(2);
  });

  it("writes the 18-slot instance layout at offset 0 for the first edge", () => {
    renderer.build(
      [makeEdge("e1", "a", "b")],
      makeLayout(), undefined, VP,
      { lod: "ground" },
    );
    const view = getMesh(renderer).view();

    // [0..1] from.xy — must match a point on file `a` (right side, mid-height).
    // We don't pin exact anchor coords (they come from computeAnchors which
    // is tested elsewhere), only that they are finite and inside file `a`.
    expect(Number.isFinite(view[0])).toBe(true);
    expect(Number.isFinite(view[1])).toBe(true);
    // file `a` is at x=0..100, y=0..80
    expect(view[0]).toBeGreaterThanOrEqual(0);
    expect(view[0]).toBeLessThanOrEqual(100);

    // [2..3] to.xy — inside file `b` (x=300..400).
    expect(view[2]).toBeGreaterThanOrEqual(300);
    expect(view[2]).toBeLessThanOrEqual(400);

    // [4..5] ctrl.xy — non-NaN.
    expect(Number.isFinite(view[4])).toBe(true);
    expect(Number.isFinite(view[5])).toBe(true);

    // [6..9] color RGBA — all in [0, 1].
    for (let i = 6; i <= 9; i++) {
      expect(view[i]).toBeGreaterThanOrEqual(0);
      expect(view[i]).toBeLessThanOrEqual(1);
    }

    // [10] width — strictly positive.
    expect(view[10]).toBeGreaterThan(0);

    // [14] flags — integer encoding.
    expect(Number.isFinite(view[14])).toBe(true);
  });

  it("violation halo appends a mesh instance behind the body stroke", () => {
    const layout = makeLayout();

    // Baseline: single edge, no overlay.
    renderer.build([makeEdge("e1", "a", "b")], layout, undefined, VP, { lod: "ground" });
    const baseline = getInstanceCount(renderer);

    // Same input + violation: one extra instance row (the halo).
    renderer.build(
      [makeEdge("e1", "a", "b")],
      layout, undefined, VP,
      { lod: "ground", violatingEdgeIds: new Set(["e1"]) },
    );
    expect(getInstanceCount(renderer)).toBeGreaterThan(baseline);

    // The halo carries EDGE_FLAG_VIOLATION. Scan mesh rows for that bit.
    const view = getMesh(renderer).view();
    let foundViolationFlag = false;
    for (let r = 0; r < getInstanceCount(renderer); r++) {
      const flags = view[r * FLOATS_PER_EDGE_INSTANCE + 14];
      if ((Math.round(flags) & EDGE_FLAG_VIOLATION) !== 0) {
        foundViolationFlag = true;
        break;
      }
    }
    expect(foundViolationFlag).toBe(true);
  });

  it("diffAdded appends a green halo instance (0x22c55e)", () => {
    renderer.build(
      [makeEdge("e1", "a", "b")],
      makeLayout(), undefined, VP,
      { lod: "ground", diffAdded: new Set(["e1"]) },
    );
    const view = getMesh(renderer).view();
    // Find a row whose RGB (slots 6..8) matches 0x22c55e = rgb(34, 197, 94).
    const GREEN_R = 0x22 / 255;
    const GREEN_G = 0xc5 / 255;
    const GREEN_B = 0x5e / 255;
    let foundGreen = false;
    for (let r = 0; r < getInstanceCount(renderer); r++) {
      const base = r * FLOATS_PER_EDGE_INSTANCE;
      if (
        Math.abs(view[base + 6] - GREEN_R) < 1e-3 &&
        Math.abs(view[base + 7] - GREEN_G) < 1e-3 &&
        Math.abs(view[base + 8] - GREEN_B) < 1e-3
      ) {
        foundGreen = true;
        break;
      }
    }
    expect(foundGreen).toBe(true);
  });

  it("diffRemoved ghost pass appends a dashed red instance (0xef4444)", () => {
    // The ghost pass iterates the raw `edges` input (not the workingEdges
    // slice), so the removed id must appear in that list to produce a row.
    renderer.build(
      [makeEdge("e1", "a", "b")],
      makeLayout(), undefined, VP,
      { lod: "ground", diffRemoved: new Set(["e1"]) },
    );
    const view = getMesh(renderer).view();
    const RED_R = 0xef / 255;
    const RED_G = 0x44 / 255;
    const RED_B = 0x44 / 255;
    let foundRedDashed = false;
    for (let r = 0; r < getInstanceCount(renderer); r++) {
      const base = r * FLOATS_PER_EDGE_INSTANCE;
      const flags = Math.round(view[base + 14]);
      const rgbMatch =
        Math.abs(view[base + 6] - RED_R) < 1e-3 &&
        Math.abs(view[base + 7] - RED_G) < 1e-3 &&
        Math.abs(view[base + 8] - RED_B) < 1e-3;
      if (rgbMatch && (flags & EDGE_FLAG_DASHED) !== 0) {
        foundRedDashed = true;
        break;
      }
    }
    expect(foundRedDashed).toBe(true);
  });

  it("skip-LOD ('universe') resets instanceCount to 0", () => {
    const layout = makeLayout();
    // First render populates the mesh at ground tier.
    renderer.build(
      [makeEdge("e1", "a", "b")],
      layout, undefined, VP,
      { lod: "ground" },
    );
    expect(getInstanceCount(renderer)).toBeGreaterThan(0);

    // Switching to a skip-LOD while the viewport scale stays the same would
    // be absorbed by LOD hysteresis (±10% scale anchor) — the renderer
    // intentionally resists mode flips on tiny zoom jitter. To verify the
    // skip path actually blanks the mesh, we move the scale far enough to
    // defeat the hysteresis window. Scale 0.01 is ~100× away from the
    // baseline 1.0 so `rel` massively exceeds the 10% threshold.
    renderer.build(
      [makeEdge("e1", "a", "b")],
      layout, undefined, { ...VP, scale: 0.01 },
      { lod: "universe" },
    );
    expect(getInstanceCount(renderer)).toBe(0);
  });

  it("clear() zeroes the mesh counter and committed instanceCount", () => {
    renderer.build(
      [makeEdge("e1", "a", "b"), makeEdge("e2", "a", "c")],
      makeLayout(), undefined, VP,
      { lod: "ground" },
    );
    expect(getInstanceCount(renderer)).toBeGreaterThan(0);

    renderer.clear();
    expect(getInstanceCount(renderer)).toBe(0);
    expect(getMeshCounter(renderer)).toBe(0);
  });

  it("smaller edge set on rebuild lowers the committed instanceCount", () => {
    const layout = makeLayout();
    renderer.build(
      [makeEdge("e1", "a", "b"), makeEdge("e2", "a", "c")],
      layout, undefined, VP,
      { lod: "ground" },
    );
    const twoEdges = getInstanceCount(renderer);

    renderer.build(
      [makeEdge("e1", "a", "b")],
      layout, undefined, VP,
      { lod: "ground" },
    );
    const oneEdge = getInstanceCount(renderer);
    expect(oneEdge).toBeLessThan(twoEdges);
  });
});
