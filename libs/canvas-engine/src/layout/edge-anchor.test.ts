import { describe, it, expect } from "vitest";
import { lineAnchor, centreAnchor, sideAnchor } from "./edge-anchor";
import type { Rect } from "../graph/types";

const rectA: Rect = { x: 0, y: 0, w: 100, h: 200 };
const rectB: Rect = { x: 300, y: 0, w: 100, h: 200 };

describe("edge-anchor", () => {
  it("horizontal neighbor to the right → from uses right side, to uses left side", () => {
    const fromPartnerX = rectB.x + rectB.w / 2; // 350 (right of A)
    const toPartnerX = rectA.x + rectA.w / 2;   // 50 (left of B)
    const fromAnchor = sideAnchor(rectA, fromPartnerX);
    const toAnchor = sideAnchor(rectB, toPartnerX);
    expect(fromAnchor.side).toBe("right");
    expect(fromAnchor.x).toBe(rectA.x + rectA.w);
    expect(toAnchor.side).toBe("left");
    expect(toAnchor.x).toBe(rectB.x);
  });

  it("vertical neighbors: sideAnchor still picks right/left based on cardCenterX", () => {
    // sideAnchor only does left/right; verify it still resolves deterministically
    // for a vertically stacked layout (same X center → partner at same X goes to right).
    const top: Rect = { x: 0, y: 0, w: 100, h: 100 };
    const bottom: Rect = { x: 0, y: 300, w: 100, h: 100 };
    const partnerX = bottom.x + bottom.w / 2;
    const anchor = sideAnchor(top, partnerX);
    // partnerX (50) === cardCenterX (50) → partnerX < cardCenterX is false → "right".
    expect(anchor.side).toBe("right");
    expect(anchor.y).toBe(top.y + top.h / 2);
  });

  it("diagonal partner snaps to the nearer horizontal side", () => {
    const rect: Rect = { x: 100, y: 100, w: 100, h: 100 };
    const farLeftPartnerX = -500;
    const farRightPartnerX = 5000;
    expect(sideAnchor(rect, farLeftPartnerX).side).toBe("left");
    expect(sideAnchor(rect, farRightPartnerX).side).toBe("right");
  });

  it("same-rect (centreAnchor) produces a finite center point — no NaN", () => {
    const anchor = centreAnchor(rectA);
    expect(Number.isFinite(anchor.x)).toBe(true);
    expect(Number.isFinite(anchor.y)).toBe(true);
    expect(anchor.x).toBe(rectA.x + rectA.w / 2);
    expect(anchor.y).toBe(rectA.y + rectA.h / 2);
  });

  it("lineAnchor clamps out-of-range line numbers", () => {
    const anchor = lineAnchor({
      rect: rectA,
      line: 9999,
      totalLines: 50,
      partnerCenterX: rectB.x + rectB.w / 2,
    });
    // Clamped to line 50 → y should be near bottom of code region but inside rect.
    expect(anchor.y).toBeGreaterThanOrEqual(rectA.y);
    expect(anchor.y).toBeLessThanOrEqual(rectA.y + rectA.h);
    expect(anchor.side).toBe("right");
  });

  it("lineAnchor handles totalLines=0 without NaN", () => {
    const anchor = lineAnchor({
      rect: rectA,
      line: 1,
      totalLines: 0,
      partnerCenterX: -100,
    });
    expect(Number.isFinite(anchor.y)).toBe(true);
    expect(anchor.side).toBe("left");
  });
});
