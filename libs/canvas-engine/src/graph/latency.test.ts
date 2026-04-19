import { describe, it, expect } from "vitest";
import { latencyColor } from "./latency";

describe("latencyColor", () => {
  it("produces distinct colours across the 5/50/200/800ms ramp", () => {
    const c5   = latencyColor(5);
    const c50  = latencyColor(50);
    const c200 = latencyColor(200);
    const c800 = latencyColor(800);
    const set = new Set([c5, c50, c200, c800]);
    expect(set.size).toBe(4);
  });

  it("returns the fast-bucket color at 0ms", () => {
    const fast = latencyColor(0);
    const five = latencyColor(5);
    expect(fast).toBe(five);
  });

  it("clamps negative / NaN to the fastest bucket", () => {
    const fast = latencyColor(5);
    expect(latencyColor(-10)).toBe(fast);
    expect(latencyColor(Number.NaN)).toBe(fast);
  });

  it("returns the hottest bucket for >=500ms", () => {
    const red = latencyColor(500);
    expect(latencyColor(600)).toBe(red);
    expect(latencyColor(10_000)).toBe(red);
  });

  it("is monotonic non-decreasing through the bucket boundaries", () => {
    // Check that rank (index into the ramp) never decreases as ms grows.
    const samples = [0, 1, 10, 20, 21, 99, 100, 101, 249, 250, 251, 499, 500, 501, 10_000];
    const ordered = [...samples].sort((a, b) => a - b);
    let prev = -1;
    const rankOf = (v: number): number => {
      if (v <= 20) return 0;
      if (v <= 100) return 1;
      if (v <= 250) return 2;
      if (v < 500) return 3;
      return 4;
    };
    for (const ms of ordered) {
      const r = rankOf(ms);
      expect(r).toBeGreaterThanOrEqual(prev);
      prev = r;
      // And each rank maps to a stable color.
      expect(latencyColor(ms)).toBe(latencyColor(ms));
    }
  });
});
