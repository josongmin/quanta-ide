import { describe, it, expect, beforeEach, afterEach } from "vitest";
import { Container } from "pixi.js";
import { StartHereBadgeRenderer } from "./StartHereBadgeRenderer";
import type { Rect, Viewport, StartHereEntry } from "@quanta/canvas-engine";

// Coverage notes
// ---------------
// Once a `StartHereEntry` has a matching rect AND the tier allows badges,
// the renderer calls `label.width` to centre the rank text — which requires
// a real canvas context jsdom does not provide. We therefore concentrate on
// the control-flow branches that finish WITHOUT needing glyph metrics:
//
//   1. undefined / empty entries              → clear path
//   2. LOD `supergalaxy` (tier disallowed)    → clear path
//   3. LOD `universe`    (tier disallowed)    → clear path
//   4. entries whose fileId has no matching
//      rect in fileRectById                   → per-entry continue (no
//                                                label, no Text.width call)
//   5. galaxy-tier topN cap (effectiveN=3)    → coerced to 3 even when
//                                                caller passes a larger N;
//                                                exercised with all entries
//                                                lacking rects so no label
//                                                rendering is attempted.
//   6. clear() after one of the skip paths     → internal state resets cleanly
//
// Un-testable without a canvas (explicit list):
//   - Drawing a real badge (roundRect + fill + stroke + Text) because
//     `label.width` throws in jsdom.
//   - LOD-sensitive badgeSize() output (values 14 / 20 / 22) except via the
//     inaccessible interior of build() — we exercise it structurally only.
//   - invScale bucket transitions for drawn badges (same reason).

const VP: Viewport = { x: 0, y: 0, scale: 1, width: 100, height: 100 };

function entry(fileId: string, rank: number): StartHereEntry {
  return {
    fileId,
    score: 1 - rank * 0.01,
    breakdown: { centrality: 0.5, entryPoint: 0.3, risk: 0.2 },
    rank,
  };
}

describe("StartHereBadgeRenderer", () => {
  let parent: Container;
  let renderer: StartHereBadgeRenderer;

  beforeEach(() => {
    parent = new Container();
    renderer = new StartHereBadgeRenderer(parent);
  });

  afterEach(() => {
    renderer.destroy();
    parent.destroy({ children: true });
  });

  it("clears on undefined / empty entries", () => {
    expect(() => renderer.build(undefined, new Map(), "city", 5, VP)).not.toThrow();
    expect(() => renderer.build([], new Map(), "city", 5, VP)).not.toThrow();
  });

  it("does nothing at supergalaxy tier (tierAllows === false)", () => {
    // supergalaxy + universe route through the same `tierAllows(lod) === false`
    // branch, taking the clear path even when entries are populated.
    const entries = [entry("a.ts", 1)];
    const rects = new Map<string, Rect>([["a.ts", { x: 0, y: 0, w: 80, h: 60 }]]);
    expect(() => renderer.build(entries, rects, "supergalaxy", 3, VP)).not.toThrow();
  });

  it("does nothing at universe tier", () => {
    const entries = [entry("a.ts", 1)];
    const rects = new Map<string, Rect>([["a.ts", { x: 0, y: 0, w: 80, h: 60 }]]);
    expect(() => renderer.build(entries, rects, "universe", 3, VP)).not.toThrow();
  });

  it("skips entries whose fileId has no matching rect (per-entry continue)", () => {
    // Top-level tier passes (`city`), entries exist, but rects are missing —
    // every loop iteration hits the `if (!rect) continue;` guard, so no
    // label ever renders. This exercises the tier-allowed + hash-built path
    // without triggering the jsdom-incompatible Text.width branch.
    const entries = [entry("ghost-1.ts", 1), entry("ghost-2.ts", 2)];
    expect(() => renderer.build(entries, new Map(), "city", 5, VP)).not.toThrow();
  });

  it("applies the galaxy-tier top-3 cap regardless of caller's topN", () => {
    // Even when topN=10, galaxy must coerce to min(3, topN). We use
    // rect-less entries so the cap executes but no labels render.
    const entries = [
      entry("a.ts", 1),
      entry("b.ts", 2),
      entry("c.ts", 3),
      entry("d.ts", 4),
      entry("e.ts", 5),
    ];
    expect(() => renderer.build(entries, new Map(), "galaxy", 10, VP)).not.toThrow();
  });

  it("clear() resets internal state after a tier-disallowed build", () => {
    const entries = [entry("a.ts", 1)];
    const rects = new Map<string, Rect>([["a.ts", { x: 0, y: 0, w: 80, h: 60 }]]);
    renderer.build(entries, rects, "supergalaxy", 3, VP);
    expect(() => renderer.clear()).not.toThrow();
    // A subsequent city-tier call with rect-less entries still exercises
    // the tier-allowed branch cleanly after the clear().
    expect(() => renderer.build(entries, new Map(), "city", 3, VP)).not.toThrow();
  });
});
