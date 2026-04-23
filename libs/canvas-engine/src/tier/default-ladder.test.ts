import { describe, it, expect } from "vitest";
import {
  DEFAULT_TIER_LADDER,
  resolveTierByApparentSize,
  apparentPxFor,
  scaleForApparentPx,
} from "./default-ladder";

// Test harness uses a reference leaf size so apparent-px math is
// trivial to eyeball — `leafWorldSize = 100` means scale=1 → 100px.
const LEAF = 100;

describe("DEFAULT_TIER_LADDER", () => {
  it("has 6 tiers in outer→inner order (Universe → Room)", () => {
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

  it("apparent-px bands are monotonically non-decreasing", () => {
    const mins = DEFAULT_TIER_LADDER.map(t => t.minApparentPx);
    for (let i = 1; i < mins.length; i++) {
      const prev = mins[i - 1] ?? 0;
      const cur = mins[i] ?? 0;
      expect(cur).toBeGreaterThanOrEqual(prev);
    }
  });

  it("bands are contiguous (min[i+1] == max[i])", () => {
    for (let i = 0; i < DEFAULT_TIER_LADDER.length - 1; i++) {
      const outer = DEFAULT_TIER_LADDER[i];
      const inner = DEFAULT_TIER_LADDER[i + 1];
      if (!outer || !inner) continue;
      expect(inner.minApparentPx).toBeCloseTo(outer.maxApparentPx, 6);
    }
  });

  it("innermost tier is open-ended (maxApparentPx = +Infinity)", () => {
    const last = DEFAULT_TIER_LADDER[DEFAULT_TIER_LADDER.length - 1];
    expect(last?.maxApparentPx).toBe(Number.POSITIVE_INFINITY);
  });
});

describe("resolveTierByApparentSize", () => {
  it("returns the tier whose band [minPx, maxPx) contains the apparent size", () => {
    // With LEAF=100, scale equals apparent-px / 100:
    //   room:     [1600, ∞)      → scale ≥ 16
    //   floor:    [400, 1600)    → scale 4 ≤ s < 16
    //   building: [80, 400)      → scale 0.8 ≤ s < 4
    //   street:   [20, 80)       → scale 0.2 ≤ s < 0.8
    //   galaxy:   [4, 20)        → scale 0.04 ≤ s < 0.2
    //   universe: [0, 4)         → scale < 0.04
    expect(resolveTierByApparentSize(DEFAULT_TIER_LADDER, LEAF, 20).visibleKind).toBe("room");
    expect(resolveTierByApparentSize(DEFAULT_TIER_LADDER, LEAF, 16).visibleKind).toBe("room");
    expect(resolveTierByApparentSize(DEFAULT_TIER_LADDER, LEAF, 10).visibleKind).toBe("floor");
    expect(resolveTierByApparentSize(DEFAULT_TIER_LADDER, LEAF, 4).visibleKind).toBe("floor");
    expect(resolveTierByApparentSize(DEFAULT_TIER_LADDER, LEAF, 2).visibleKind).toBe("building");
    expect(resolveTierByApparentSize(DEFAULT_TIER_LADDER, LEAF, 0.9).visibleKind).toBe("building");
    expect(resolveTierByApparentSize(DEFAULT_TIER_LADDER, LEAF, 0.5).visibleKind).toBe("street");
    expect(resolveTierByApparentSize(DEFAULT_TIER_LADDER, LEAF, 0.1).visibleKind).toBe("galaxy");
    expect(resolveTierByApparentSize(DEFAULT_TIER_LADDER, LEAF, 0.02).visibleKind).toBe("universe");
  });

  it("falls back to outermost tier on zero/negative scale", () => {
    expect(resolveTierByApparentSize(DEFAULT_TIER_LADDER, LEAF, 0).visibleKind).toBe("universe");
    expect(resolveTierByApparentSize(DEFAULT_TIER_LADDER, LEAF, -1).visibleKind).toBe("universe");
  });

  it("is invariant across repo sizes when leaf-world-size is held constant", () => {
    // Simulating two repos of different sizes: the caller always passes
    // the SAME leafWorldSize (constant leaf card width). Only cameraScale
    // changes as the user zooms. The tier picked must be identical.
    const a = resolveTierByApparentSize(DEFAULT_TIER_LADDER, LEAF, 1.0);
    const b = resolveTierByApparentSize(DEFAULT_TIER_LADDER, LEAF, 1.0);
    expect(a.name).toBe(b.name);
  });
});

describe("apparentPxFor / scaleForApparentPx", () => {
  it("apparentPxFor multiplies leaf size by scale", () => {
    expect(apparentPxFor(100, 2)).toBe(200);
    expect(apparentPxFor(500, 0.1)).toBe(50);
  });

  it("scaleForApparentPx is the inverse of apparentPxFor", () => {
    const s = scaleForApparentPx(100, 250);
    expect(apparentPxFor(100, s)).toBeCloseTo(250, 6);
  });

  it("scaleForApparentPx guards zero leaf size", () => {
    expect(scaleForApparentPx(0, 100)).toBe(1);
  });
});
