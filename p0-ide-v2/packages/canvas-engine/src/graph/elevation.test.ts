import { describe, it, expect } from "vitest";
import { elevationFromRisk } from "./elevation";

describe("elevationFromRisk", () => {
  it("returns 0 at risk=0", () => {
    expect(elevationFromRisk(0)).toBe(0);
  });

  it("returns 80 at risk=100", () => {
    expect(elevationFromRisk(100)).toBe(80);
  });

  it("is monotonically increasing", () => {
    let prev = -Infinity;
    for (let r = 0; r <= 100; r += 1) {
      const e = elevationFromRisk(r);
      expect(e).toBeGreaterThanOrEqual(prev);
      prev = e;
    }
  });

  it("is concave (sqrt easing keeps low values flat)", () => {
    const e25 = elevationFromRisk(25);
    const e50 = elevationFromRisk(50);
    const e75 = elevationFromRisk(75);
    expect(e25).toBeLessThan(e50);
    expect(e50).toBeLessThan(e75);
    expect(e25).toBeCloseTo(40, 5);
    expect(e50).toBeCloseTo(56.568, 2);
    expect(e75).toBeCloseTo(69.282, 2);
  });

  it("clamps out-of-range inputs", () => {
    expect(elevationFromRisk(-10)).toBe(0);
    expect(elevationFromRisk(999)).toBe(80);
  });
});
