import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Container, Graphics } from "pixi.js";
import { TraceEdgeRenderer } from "./TraceEdgeRenderer";
import type {
  TraceEdge,
  WorkspaceLayout,
  Viewport,
  Rect,
} from "@quanta/canvas-engine";

// Coverage notes
// ---------------
// TraceEdgeRenderer renders the dynamic trace overlay (cyan→magenta
// gradient + animated pulse). Under jsdom we can exercise every branch
// of `build()`:
//   1. empty / undefined edges → clear path
//   2. valid edges → gradient pass + animated pulse + optional badge
//   3. edge with missing file rect → silently skipped
//
// Badge path creates a Pixi `Text`. The constructor touches a Text style
// under jsdom which works (Text.width is 0, but no layout throw — the
// renderer positions the badge via midX/midY unconditionally so 0 width
// is safe).

function makeLayout(): WorkspaceLayout {
  const fileRects = new Map<string, Rect>();
  fileRects.set("a", { x: 0, y: 0, w: 100, h: 80 });
  fileRects.set("b", { x: 300, y: 0, w: 100, h: 80 });
  return {
    fileRects,
    edgeRoutes: new Map(),
    aggregates: {
      commentsByFunction: new Map(),
      commentsByFile: new Map(),
      commentedLines: new Map(),
    },
    totalBounds: { x: 0, y: 0, w: 400, h: 80 },
  };
}

function makeTrace(overrides: Partial<TraceEdge> = {}): TraceEdge {
  return {
    from: "a",
    to: "b",
    callCount: 1,
    totalDurationMs: 100,
    ...overrides,
  };
}

const VP: Viewport = { x: 0, y: 0, scale: 1, width: 800, height: 600 };

function privateGfx(r: TraceEdgeRenderer): Graphics {
  return (r as unknown as { gfx: Graphics }).gfx;
}

describe("TraceEdgeRenderer", () => {
  let parent: Container;
  let renderer: TraceEdgeRenderer;

  beforeEach(() => {
    parent = new Container();
    renderer = new TraceEdgeRenderer(parent);
  });

  afterEach(() => {
    renderer.destroy();
    parent.destroy({ children: true });
  });

  it("build(undefined) clears without drawing", () => {
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    renderer.build(undefined, layout, VP);
    expect(strokeSpy).not.toHaveBeenCalled();
  });

  it("build([]) clears without drawing", () => {
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    renderer.build([], layout, VP);
    expect(strokeSpy).not.toHaveBeenCalled();
  });

  it("draws cyan + magenta gradient passes for a single trace edge", () => {
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    renderer.build([makeTrace()], layout, VP);

    // First half gradient uses COLOR_SOURCE (FLOW_CYAN) and second half
    // uses COLOR_SINK (0xec4899). Both must appear in the stroke signature.
    const colors = strokeSpy.mock.calls
      .map(args => (args[0] as { color?: number } | undefined)?.color)
      .filter((c): c is number => typeof c === "number");
    // COLOR_SINK is 0xec4899; COLOR_SOURCE is whatever FLOW_CYAN is — we
    // only assert that at least two distinct colours were emitted (i.e.
    // the gradient approximation produced both halves).
    const distinct = new Set(colors);
    expect(distinct.size).toBeGreaterThanOrEqual(2);
    expect(colors).toContain(0xec4899);
  });

  it("silently skips edges whose endpoint is missing a rect", () => {
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    // `ghost` not in layout.fileRects — the `if (!fromRect || !toRect) continue`
    // branch must not throw and must not issue strokes for the bad edge.
    renderer.build(
      [makeTrace({ from: "a", to: "ghost" })],
      layout,
      VP,
    );
    expect(strokeSpy).not.toHaveBeenCalled();
  });

  it("draws a badge rect when callCount >= 2", () => {
    // The badge branch reads `badge.width` which hits Pixi's
    // CanvasTextMetrics, unsupported in jsdom. We stub the acquireBadge
    // path to return a Text-like object with a fixed `.width`.
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const roundRectSpy = vi.spyOn(gfx, "roundRect");
    // Install a stub badge on the internal pool so acquireBadge returns it
    // instead of constructing a real Text.
    const stubBadge = {
      text: "",
      visible: false,
      anchor: { set: () => {} },
      scale: { set: () => {} },
      x: 0,
      y: 0,
      width: 10,
      height: 8,
      style: { fill: 0xffffff, fontSize: 10 },
      destroy: () => {},
    };
    (renderer as unknown as {
      badgePool: unknown[];
    }).badgePool = [stubBadge];
    renderer.build(
      [makeTrace({ callCount: 12, totalDurationMs: 500 })],
      layout,
      VP,
    );
    // A count >=2 adds a dark pill under the "×N" text via roundRect.
    expect(roundRectSpy).toHaveBeenCalled();
  });

  it("omits the badge rect when callCount < 2", () => {
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const roundRectSpy = vi.spyOn(gfx, "roundRect");
    renderer.build([makeTrace({ callCount: 1 })], layout, VP);
    expect(roundRectSpy).not.toHaveBeenCalled();
  });

  it("clear() stops issuing strokes on subsequent ticks", () => {
    const layout = makeLayout();
    renderer.build([makeTrace()], layout, VP);
    renderer.clear();
    // After clear, hasContent is false and lastEdges is empty.
    expect((renderer as unknown as { hasContent: boolean }).hasContent).toBe(
      false,
    );
  });

  it("uses opts.fileRects override when provided", () => {
    // Supplying a custom rect map lets the caller route via a different
    // layout (e.g. hover-isolated subset). Confirm the override is honoured.
    const layout = makeLayout();
    const gfx = privateGfx(renderer);
    const strokeSpy = vi.spyOn(gfx, "stroke");
    const override = new Map<string, Rect>();
    override.set("a", { x: 0, y: 0, w: 40, h: 30 });
    override.set("b", { x: 400, y: 0, w: 40, h: 30 });
    renderer.build([makeTrace()], layout, VP, { fileRects: override });
    // Same gradient signature as before — the rect swap doesn't gate
    // colour selection, only position math.
    expect(strokeSpy).toHaveBeenCalled();
  });
});
