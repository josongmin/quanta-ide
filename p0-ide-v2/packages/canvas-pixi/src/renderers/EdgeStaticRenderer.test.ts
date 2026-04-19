import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Container, Graphics } from "pixi.js";
import { EdgeStaticRenderer } from "./EdgeStaticRenderer";
import type {
  FileEdge,
  WorkspaceLayout,
  Viewport,
  Rect,
  EdgeKind,
  BezierRoute,
} from "@quanta/canvas-engine";

// Coverage notes
// ---------------
// `EdgeStaticRenderer.build()` has many branching overlays — LOD gate,
// violation halos, focus dim, diff halos/ghosts, cross-graph flash,
// temporal filter, custom predicate. Under jsdom, `Graphics` buffers all
// primitive calls (moveTo/bezierCurveTo/stroke) into a display list
// without needing a GL context, so we can spy on `stroke()` call counts
// to detect whether a branch produced geometry or not.
//
// What's NOT tested here:
//   - Pixel-level output (no GL context).
//   - The internal shared pixi Ticker advancing dashOffset (indirect via
//     a flag assertion, not by waiting real frames).
//   - The bundling cache inner state (covered by edge-bundling tests).

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

function makeEdge(
  id: string,
  from: string,
  to: string,
  overrides: Partial<FileEdge> = {},
): FileEdge {
  return {
    id,
    from,
    to,
    kind: "call",
    layer: "structural",
    weight: 1,
    ...overrides,
  };
}

const VP: Viewport = { x: 0, y: 0, scale: 1, width: 800, height: 600 };

// Helper: pull out the private `gfx` field so tests can spy on stroke.
function privateGfx(r: EdgeStaticRenderer): Graphics {
  return (r as unknown as { gfx: Graphics }).gfx;
}

describe("EdgeStaticRenderer — base paths", () => {
  let parent: Container;
  let renderer: EdgeStaticRenderer;

  beforeEach(() => {
    parent = new Container();
    renderer = new EdgeStaticRenderer(parent);
  });

  afterEach(() => {
    renderer.destroy();
    parent.destroy({ children: true });
  });

  it("build([]) returns cleanly on the empty-edge fast path", () => {
    // Empty in, previousLength starts at 0 — this hits the fast-skip branch
    // before any Graphics work. Contract: no throw, no stroke.
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    renderer.build([], layout, undefined, VP, { lod: "ground" });
    expect(strokeSpy).not.toHaveBeenCalled();
  });

  it("skips all draw work when lod is 'supergalaxy' (LOD gate)", () => {
    // Supergalaxy + universe are in EDGE_SKIP_LODS — the renderer bails
    // before the draw loop. Verify `stroke` is never called.
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    renderer.build(
      [makeEdge("e1", "a", "b")],
      layout,
      undefined,
      VP,
      { lod: "supergalaxy" },
    );
    expect(strokeSpy).not.toHaveBeenCalled();
  });

  it("skips draw work when lod is 'universe' (LOD gate)", () => {
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    renderer.build(
      [makeEdge("e1", "a", "b")],
      layout,
      undefined,
      VP,
      { lod: "universe" },
    );
    expect(strokeSpy).not.toHaveBeenCalled();
  });

  it("issues stroke calls for normal edges at 'ground' lod", () => {
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    renderer.build(
      [makeEdge("e1", "a", "b"), makeEdge("e2", "a", "c")],
      layout,
      undefined,
      VP,
      { lod: "ground" },
    );
    // Each non-skipped edge issues at least one stroke for the bezier body;
    // directional kinds may add arrow fills (fill, not stroke), so we assert
    // stroke was called at least once per edge.
    expect(strokeSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });
});

describe("EdgeStaticRenderer — overlay branches", () => {
  let parent: Container;
  let renderer: EdgeStaticRenderer;

  beforeEach(() => {
    parent = new Container();
    renderer = new EdgeStaticRenderer(parent);
  });

  afterEach(() => {
    renderer.destroy();
    parent.destroy({ children: true });
  });

  it("violatingEdgeIds triggers an extra halo stroke pass", () => {
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const baseSpy = vi.spyOn(gfx, "stroke");
    renderer.build(
      [makeEdge("e1", "a", "b")],
      layout,
      undefined,
      VP,
      { lod: "ground" },
    );
    const baseline = baseSpy.mock.calls.length;
    baseSpy.mockClear();

    renderer.build(
      [makeEdge("e2", "a", "b")],
      layout,
      undefined,
      VP,
      {
        lod: "ground",
        violatingEdgeIds: new Set(["e2"]),
      },
    );
    // With the violating halo pass, stroke call count must exceed the
    // baseline (one extra halo stroke per violating edge).
    expect(baseSpy.mock.calls.length).toBeGreaterThan(baseline);
  });

  it("diffAdded adds a green halo stroke under the edge", () => {
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    renderer.build(
      [makeEdge("e1", "a", "b")],
      layout,
      undefined,
      VP,
      {
        lod: "ground",
        diffAdded: new Set(["e1"]),
      },
    );
    // Look for the green halo stroke signature (color 0x22c55e).
    const found = strokeSpy.mock.calls.some(args => {
      const opts = args[0] as { color?: number } | undefined;
      return opts?.color === 0x22c55e;
    });
    expect(found).toBe(true);
  });

  it("diffRemoved draws a red dashed ghost pass even for absent edges", () => {
    // diffRemoved iterates the `edges` array (not workingEdges), so a
    // removed id must be in the input list to render. The ghost pass runs
    // AFTER the main loop and uses the GHOST_COLOR = 0xef4444 signature.
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    renderer.build(
      [makeEdge("e1", "a", "b")],
      layout,
      undefined,
      VP,
      {
        lod: "ground",
        diffRemoved: new Set(["e1"]),
      },
    );
    const found = strokeSpy.mock.calls.some(args => {
      const opts = args[0] as { color?: number } | undefined;
      return opts?.color === 0xef4444;
    });
    expect(found).toBe(true);
  });

  it("temporalEdgeSet restricts rendering to members only", () => {
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    const edges = [makeEdge("e1", "a", "b"), makeEdge("e2", "a", "c")];
    renderer.build(
      edges,
      layout,
      undefined,
      VP,
      {
        lod: "ground",
        // Only e1 is live in the temporal slice.
        temporalEdgeSet: new Set(["e1"]),
      },
    );
    const callsWithOnly = strokeSpy.mock.calls.length;

    // Rebuild with BOTH in the set — should produce more stroke calls.
    const gfx2 = privateGfx(renderer);
    const strokeSpy2 = vi.spyOn(gfx2, "stroke");
    strokeSpy2.mockClear();
    renderer.build(
      edges,
      layout,
      undefined,
      VP,
      {
        lod: "ground",
        temporalEdgeSet: new Set(["e1", "e2"]),
      },
    );
    expect(strokeSpy2.mock.calls.length).toBeGreaterThan(callsWithOnly);
  });

  it("customPredicate filters out edges that evaluate to false", () => {
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    const edges = [
      makeEdge("e1", "a", "b", { kind: "call" }),
      makeEdge("e2", "a", "c", { kind: "import" as EdgeKind }),
    ];
    renderer.build(
      edges,
      layout,
      undefined,
      VP,
      {
        lod: "ground",
        // Only `call` kind passes.
        customPredicate: (e) => e.kind === "call",
      },
    );
    const withFilter = strokeSpy.mock.calls.length;

    strokeSpy.mockClear();
    renderer.build(
      edges,
      layout,
      undefined,
      VP,
      {
        lod: "ground",
        customPredicate: () => true,
      },
    );
    expect(strokeSpy.mock.calls.length).toBeGreaterThan(withFilter);
  });

  it("kindFilter excludes edges whose kind is disabled", () => {
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    const edges = [
      makeEdge("e1", "a", "b", { kind: "call" }),
      makeEdge("e2", "a", "c", { kind: "import" as EdgeKind }),
    ];
    renderer.build(
      edges,
      layout,
      undefined,
      VP,
      {
        lod: "ground",
        kindFilter: { call: false },
      },
    );
    // Only `import` edge draws → fewer stroke calls than both.
    const withFilter = strokeSpy.mock.calls.length;
    strokeSpy.mockClear();
    renderer.build(edges, layout, undefined, VP, { lod: "ground" });
    expect(strokeSpy.mock.calls.length).toBeGreaterThan(withFilter);
  });

  it("hasAnimatedEdges flag toggles with edge.animated presence", () => {
    const layout = makeLayout();
    // Access the private flag directly to check it's been updated.
    renderer.build(
      [makeEdge("e1", "a", "b", { animated: true })],
      layout,
      undefined,
      VP,
      { lod: "ground" },
    );
    expect(
      (renderer as unknown as { hasAnimatedEdges: boolean }).hasAnimatedEdges,
    ).toBe(true);

    renderer.build(
      [makeEdge("e2", "a", "b", { animated: false })],
      layout,
      undefined,
      VP,
      { lod: "ground" },
    );
    expect(
      (renderer as unknown as { hasAnimatedEdges: boolean }).hasAnimatedEdges,
    ).toBe(false);
  });

  it("ref-equal input array short-circuits the animation scan", () => {
    const layout = makeLayout();
    const edges = [makeEdge("e1", "a", "b", { animated: true })];
    renderer.build(edges, layout, undefined, VP, { lod: "ground" });
    // `lastScannedEdges` records the array identity — calling build with
    // the same reference must not re-run the `.some(animated)` scan. We
    // confirm indirectly by mutating array contents and checking the
    // cached flag holds (correct behaviour: the cache is identity-based).
    const originalFlag = (renderer as unknown as {
      hasAnimatedEdges: boolean;
    }).hasAnimatedEdges;
    // Same reference → the scan short-circuits even though we changed
    // `animated` in place (upstream contract: callers don't mutate arrays;
    // this test documents that the scan does not re-run).
    edges[0].animated = false;
    renderer.build(edges, layout, undefined, VP, { lod: "ground" });
    expect(
      (renderer as unknown as { hasAnimatedEdges: boolean }).hasAnimatedEdges,
    ).toBe(originalFlag);
  });

  it("focus dims non-focused edges via alpha multiplier (runs non-throwing)", () => {
    // We can't read the alpha from Graphics' internal state, but we can
    // assert the branch runs non-throwing and still issues strokes.
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    renderer.build(
      [makeEdge("e1", "a", "b"), makeEdge("e2", "a", "c")],
      layout,
      undefined,
      VP,
      {
        lod: "ground",
        focus: { edgeIds: new Set(["e1"]), dimAlpha: 0.2 },
      },
    );
    // Both edges still render (focus only dims, doesn't hide).
    expect(strokeSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("crossGraphFlash dims non-flashed cross-graph edges", () => {
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    renderer.build(
      [
        makeEdge("e1", "a", "b", { crossGraph: true }),
        makeEdge("e2", "a", "c", { crossGraph: true }),
      ],
      layout,
      undefined,
      VP,
      {
        lod: "ground",
        crossGraphFlash: new Set(["e1"]),
      },
    );
    // Both cross-graph edges still draw; one is flashed, one is dimmed.
    expect(strokeSpy).toHaveBeenCalled();
  });

  it("showCrossGraphEdges:false skips cross-graph edges entirely", () => {
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    const edges = [
      makeEdge("e1", "a", "b", { crossGraph: true }),
      makeEdge("e2", "a", "c", { crossGraph: false }),
    ];
    renderer.build(
      edges,
      layout,
      undefined,
      VP,
      { lod: "ground", showCrossGraphEdges: false },
    );
    const suppressed = strokeSpy.mock.calls.length;

    strokeSpy.mockClear();
    renderer.build(
      edges,
      layout,
      undefined,
      VP,
      { lod: "ground", showCrossGraphEdges: true },
    );
    // Suppressing cross-graph must reduce the stroke count vs. including them.
    expect(strokeSpy.mock.calls.length).toBeGreaterThan(suppressed);
  });
});
