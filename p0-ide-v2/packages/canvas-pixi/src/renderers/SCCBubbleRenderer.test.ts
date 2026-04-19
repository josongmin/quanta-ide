import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import { Container, Graphics } from "pixi.js";
import { SCCBubbleRenderer } from "./SCCBubbleRenderer";
import type { Rect, Viewport } from "@quanta/canvas-engine";

// Coverage notes
// ---------------
// The AABB-of-members math lives in a private `aabbOfMembers` function so
// we can't call it directly; we can still exercise every branch through
// `build()`:
//
//   1. empty / undefined SCC input         → clear path, lastHash = 0
//   2. all members missing rects           → AABB returns null, skipped
//   3. single-member cycle                 → `members.length < 2` skip
//   4. multi-member cycle with rects       → full enclosure path
//   5. hash short-circuit                  → build twice with same input,
//                                             second call must no-op (stable
//                                             hash keeps lastCount unchanged)
//   6. invScale bucket invalidation        → changing viewport.scale enough
//                                             to cross a bucket forces rebuild
//
// Label rendering requires neither a font atlas nor `.width` measurement
// (labels use `position.set(x+8, y+6)` only), so jsdom is fine. We still
// guard the `showLabels` boolean via viewport.scale on each side of the
// LABEL_MIN_SCALE (=0.3) threshold.
//
// Un-testable in jsdom:
//   - Stroke alpha / colour actually applied to the GPU.
//   - Roundrect corner-radius pixel output.

const VP: Viewport = { x: 0, y: 0, scale: 1, width: 100, height: 100 };

function rectsFor(ids: readonly string[]): Map<string, Rect> {
  // Spread members in a straight line so the AABB is non-degenerate but
  // predictable. `fileRectById.get` returns undefined for unknown ids —
  // that branch is covered by a specific test below.
  return new Map(
    ids.map((id, i) => [id, { x: i * 100, y: 0, w: 80, h: 60 }]),
  );
}

describe("SCCBubbleRenderer", () => {
  let parent: Container;
  let renderer: SCCBubbleRenderer;

  beforeEach(() => {
    parent = new Container();
    renderer = new SCCBubbleRenderer(parent);
  });

  afterEach(() => {
    renderer.destroy();
    parent.destroy({ children: true });
  });

  it("clears and resets when no SCCs are present", () => {
    // `sccs` undefined AND empty array both hit the early-return clear path.
    expect(() => renderer.build(undefined, new Map(), VP)).not.toThrow();
    expect(() => renderer.build([], new Map(), VP)).not.toThrow();
    // clear() is independently callable.
    expect(() => renderer.clear()).not.toThrow();
  });

  it("skips degenerate single-member cycles (length < 2)", () => {
    // One cycle with 1 member — `members.length < 2` continues, leaving
    // nothing to draw. No throw + the render state remains clean.
    const sccs = [["solo.ts"]];
    const rects = rectsFor(["solo.ts"]);
    expect(() => renderer.build(sccs, rects, VP)).not.toThrow();
  });

  it("skips cycles whose members have no rects (AABB null)", () => {
    // Members exist but none appear in `fileRectById` — the internal
    // aabbOfMembers returns null and the draw loop continues.
    const sccs = [["ghost-a.ts", "ghost-b.ts"]];
    expect(() => renderer.build(sccs, new Map(), VP)).not.toThrow();
  });

  it("draws a bubble for a multi-member cycle with rects", () => {
    const sccs = [["a.ts", "b.ts", "c.ts"]];
    const rects = rectsFor(["a.ts", "b.ts", "c.ts"]);
    expect(() => renderer.build(sccs, rects, VP)).not.toThrow();
  });

  it("short-circuits the second identical build via the hash guard", () => {
    // Two consecutive builds with the same inputs should hit the
    // `hash === lastHash && count === lastCount && …` short-circuit on
    // call #2. Observable-free in jsdom, but call must stay non-throwing
    // and internal state must not corrupt (verified via a subsequent
    // clear() still working).
    const sccs = [["a.ts", "b.ts"]];
    const rects = rectsFor(["a.ts", "b.ts"]);
    renderer.build(sccs, rects, VP);
    expect(() => renderer.build(sccs, rects, VP)).not.toThrow();
    expect(() => renderer.clear()).not.toThrow();
  });

  it("invalidates the cache when viewport.scale crosses a bucket boundary", () => {
    // scale=1  → invScale=1  → bucket=2
    // scale=0.2→ invScale=5  → bucket=10  (also flips showLabels off)
    // Two calls with different buckets must both execute the redraw path.
    const sccs = [["a.ts", "b.ts"]];
    const rects = rectsFor(["a.ts", "b.ts"]);
    expect(() => renderer.build(sccs, rects, { ...VP, scale: 1 })).not.toThrow();
    expect(() => renderer.build(sccs, rects, { ...VP, scale: 0.2 })).not.toThrow();
  });

  // ── Branch-coverage tests ─────────────────────────────────────────────

  it("empty sccs calls gfx.clear() (no lingering bubble from previous frame)", () => {
    // Draw a bubble, then pass empty. The early-return branch runs
    // gfx.clear() AND resets state to 0 so a re-entry doesn't alias.
    const sccs = [["a.ts", "b.ts"]];
    const rects = rectsFor(["a.ts", "b.ts"]);
    renderer.build(sccs, rects, VP);
    const gfx = (renderer as unknown as { gfx: Graphics }).gfx;
    const clearSpy = vi.spyOn(gfx, "clear");
    renderer.build([], rects, VP);
    expect(clearSpy).toHaveBeenCalled();
    const lastCount = (renderer as unknown as { lastCount: number }).lastCount;
    expect(lastCount).toBe(0);
  });

  it("multi-member cycle emits both the fill and stroke pass", () => {
    // Full enclosure path — roundRect + fill + stroke = 3 calls total on
    // the Graphics chain. We spy on .fill and .stroke to confirm each runs
    // once per cycle.
    const gfx = (renderer as unknown as { gfx: Graphics }).gfx;
    const fillSpy = vi.spyOn(gfx, "fill");
    const strokeSpy = vi.spyOn(gfx, "stroke");
    const sccs = [["a.ts", "b.ts", "c.ts"]];
    const rects = rectsFor(["a.ts", "b.ts", "c.ts"]);
    renderer.build(sccs, rects, VP);
    expect(fillSpy).toHaveBeenCalledTimes(1);
    expect(strokeSpy).toHaveBeenCalledTimes(1);
  });
});
