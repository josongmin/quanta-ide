import { describe, it, expect } from "vitest";
import { DEFAULT_TIER_LADDER, resolveTierByScale } from "./default-ladder";

describe("DEFAULT_TIER_LADDER", () => {
  it("has 6 tiers in outer→inner order", () => {
    expect(DEFAULT_TIER_LADDER).toHaveLength(6);
    expect(DEFAULT_TIER_LADDER.map(t => t.visibleKind)).toEqual([
      "universe",
      "galaxy",
      "street",
      "building",
      "floor",
      "room",
    ]);
  });

  it("thresholds are monotonically non-decreasing", () => {
    const ups = DEFAULT_TIER_LADDER.map(t => t.upThreshold);
    for (let i = 1; i < ups.length; i++) {
      const prev = ups[i - 1] ?? 0;
      const cur = ups[i] ?? 0;
      expect(cur).toBeGreaterThanOrEqual(prev);
    }
  });

  it("bands are contiguous (down[i+1] == up[i] ± overlap)", () => {
    // Each inner tier's downThreshold equals the outer tier's
    // upThreshold — i.e. the hand-off band is zero-width. This is
    // intentional: hysteresis lives in the consumer, not in gaps.
    for (let i = 0; i < DEFAULT_TIER_LADDER.length - 1; i++) {
      const outer = DEFAULT_TIER_LADDER[i];
      const inner = DEFAULT_TIER_LADDER[i + 1];
      if (!outer || !inner) continue;
      expect(inner.downThreshold).toBeCloseTo(outer.upThreshold, 6);
    }
  });
});

describe("resolveTierByScale", () => {
  it("returns the tier whose band [down, up) contains the scale", () => {
    // room:    [0.70, +Inf)
    // floor:   [0.13, 0.70)
    // building:[0.10, 0.13)
    // street:  [0.07, 0.10)
    // galaxy:  [0.015, 0.07)
    // universe:[0.008, 0.015)
    expect(resolveTierByScale(DEFAULT_TIER_LADDER, 2).visibleKind).toBe("room");
    expect(resolveTierByScale(DEFAULT_TIER_LADDER, 0.8).visibleKind).toBe("room");
    expect(resolveTierByScale(DEFAULT_TIER_LADDER, 0.20).visibleKind).toBe("floor");
    expect(resolveTierByScale(DEFAULT_TIER_LADDER, 0.12).visibleKind).toBe("building");
    expect(resolveTierByScale(DEFAULT_TIER_LADDER, 0.08).visibleKind).toBe("street");
    expect(resolveTierByScale(DEFAULT_TIER_LADDER, 0.02).visibleKind).toBe("galaxy");
    expect(resolveTierByScale(DEFAULT_TIER_LADDER, 0.01).visibleKind).toBe("universe");
  });

  it("falls back to outermost tier on zero/negative scale", () => {
    expect(resolveTierByScale(DEFAULT_TIER_LADDER, 0).visibleKind).toBe("universe");
    expect(resolveTierByScale(DEFAULT_TIER_LADDER, -1).visibleKind).toBe("universe");
  });
});
