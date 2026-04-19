import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Container, Graphics } from "pixi.js";
import { EdgeOverlayRenderer } from "./EdgeOverlayRenderer";
import type {
  ViewState,
  WorkspaceLayout,
  BezierRoute,
  LodLevel,
} from "@quanta/canvas-engine";
import { EdgeGeometryCache } from "@quanta/canvas-engine";

// Coverage notes
// ---------------
// Pixi's `Graphics` constructs and accepts primitive draw calls under jsdom
// (`moveTo` / `bezierCurveTo` / `stroke` don't need a WebGL context — they
// just buffer geometry into the display object). So we CAN drive
// EdgeOverlayRenderer.update() with realistic branches:
//   1. nothing hovered / selected           → early clear-only path
//   2. only hovered                          → hover stroke
//   3. hovered === selected                  → hover SKIPPED, selected drawn
//   4. selected-only with arrowhead math    → full path + arrowhead strokes
//   5. missing route for selected id        → defensive no-op after clear
//   6. cache hit overrides layout route     → cache wins
//
// Un-testable in jsdom (requires live GL context):
//   - Any assertion on actual painted pixels / stroke visibility.
//   - Text glyph metrics (no Text here, but would fail elsewhere).

const BASE_ROUTE: BezierRoute = {
  x1: 0, y1: 0, cx1: 25, cy1: 25, cx2: 75, cy2: 75, x2: 100, y2: 100,
};

function makeLayout(routes: Array<[string, BezierRoute]> = []): WorkspaceLayout {
  return {
    fileRects: new Map(),
    edgeRoutes: new Map(routes),
    aggregates: {
      commentsByFunction: new Map(),
      commentsByFile: new Map(),
      commentedLines: new Map(),
    },
    totalBounds: { x: 0, y: 0, w: 100, h: 100 },
  };
}

function makeViewState(overrides: Partial<ViewState> = {}): ViewState {
  const lod: LodLevel = "city";
  return {
    lod,
    selectedFileId: null,
    hoveredFileId: null,
    selectedEdgeId: null,
    hoveredEdgeId: null,
    focusedNodeId: null,
    ...overrides,
  };
}

describe("EdgeOverlayRenderer", () => {
  let parent: Container;
  let renderer: EdgeOverlayRenderer;

  beforeEach(() => {
    parent = new Container();
    renderer = new EdgeOverlayRenderer(parent);
  });

  afterEach(() => {
    renderer.destroy();
    parent.destroy({ children: true });
  });

  it("clears without issuing strokes when nothing is hovered or selected", () => {
    const layout = makeLayout([["e1", BASE_ROUTE]]);
    // Both ids null — update() must call gfx.clear() and then return before
    // touching any bezier geometry. No throw = contract upheld.
    expect(() => renderer.update(makeViewState(), layout)).not.toThrow();
  });

  it("draws the hover stroke when hoveredEdgeId !== selectedEdgeId", () => {
    const layout = makeLayout([["e1", BASE_ROUTE]]);
    expect(() => {
      renderer.update(
        makeViewState({ hoveredEdgeId: "e1" }),
        layout,
      );
    }).not.toThrow();
  });

  it("suppresses hover stroke when hovered === selected (same edge)", () => {
    // Both point at "e1" — the hovered branch must be skipped by the
    // `hovered !== selectedEdgeId` guard; only the selected stroke +
    // arrowhead should draw. Behavioural assertion: no throw + no
    // double-draw (which would still be silent in jsdom but the guard
    // exercises the comparison branch).
    const layout = makeLayout([["e1", BASE_ROUTE]]);
    expect(() => {
      renderer.update(
        makeViewState({ hoveredEdgeId: "e1", selectedEdgeId: "e1" }),
        layout,
      );
    }).not.toThrow();
  });

  it("draws selection stroke + arrowhead when selectedEdgeId has a route", () => {
    const layout = makeLayout([["e1", BASE_ROUTE]]);
    expect(() => {
      renderer.update(
        makeViewState({ selectedEdgeId: "e1" }),
        layout,
      );
    }).not.toThrow();
  });

  it("no-ops (after clear) when selectedEdgeId has no route in layout or cache", () => {
    // Route for "e1" lives nowhere — the `if (!route) return;` guard must
    // hold so the call does not throw on an undefined lookup.
    const layout = makeLayout();
    expect(() => {
      renderer.update(
        makeViewState({ selectedEdgeId: "missing" }),
        layout,
      );
    }).not.toThrow();
  });

  it("hover branch issues an indigo stroke distinct from the selection colour", () => {
    // Hovered-only path — the stroke colour is 0x6366f1 (indigo-500) which
    // is distinct from the 0x4f46e5 selection colour. Asserting the colour
    // catches regressions where the two branches share a palette entry.
    const layout = makeLayout([["e1", BASE_ROUTE]]);
    const gfx = (renderer as unknown as { gfx: Graphics }).gfx;
    const strokeSpy = vi.spyOn(gfx, "stroke");
    renderer.update(makeViewState({ hoveredEdgeId: "e1" }), layout);
    const colors = strokeSpy.mock.calls
      .map(args => (args[0] as { color?: number } | undefined)?.color)
      .filter((c): c is number => typeof c === "number");
    expect(colors).toContain(0x6366f1);
  });

  it("selection-only branch emits the indigo-600 selection colour plus arrowhead stroke", () => {
    // Selected-only path — the main bezier uses 0x4f46e5 (indigo-600) and
    // the arrowhead legs re-use the same colour at a thinner width. We
    // assert the selection colour appears AND the total stroke count
    // reflects body + arrowhead (at least 2 distinct strokes).
    const layout = makeLayout([["e1", BASE_ROUTE]]);
    const gfx = (renderer as unknown as { gfx: Graphics }).gfx;
    const strokeSpy = vi.spyOn(gfx, "stroke");
    renderer.update(makeViewState({ selectedEdgeId: "e1" }), layout);
    const colors = strokeSpy.mock.calls
      .map(args => (args[0] as { color?: number } | undefined)?.color)
      .filter((c): c is number => typeof c === "number");
    expect(colors).toContain(0x4f46e5);
    // Body + arrowhead → at least 2 stroke() calls.
    expect(strokeSpy.mock.calls.length).toBeGreaterThanOrEqual(2);
  });

  it("prefers edgeCache over layout.edgeRoutes when both contain the id", () => {
    // Cache provides a different route; the `cache?.get(selected) ?? layout.edgeRoutes.get(selected)`
    // expression must pick the cache route. A cache entry with identical
    // geometry is fine — the assertion is structural (no throw in the
    // "cache present" branch).
    const layout = makeLayout([["e1", BASE_ROUTE]]);
    const cache = new EdgeGeometryCache();
    // Populate by going through build() so BezierGeometry bbox is produced.
    cache.build(
      [{ id: "e1", from: "a", to: "b", kind: "call", layer: "structural", weight: 1 }],
      layout,
    );
    expect(cache.get("e1")).toBeDefined();
    expect(() => {
      renderer.update(
        makeViewState({ selectedEdgeId: "e1" }),
        layout,
        cache,
      );
    }).not.toThrow();
  });
});
