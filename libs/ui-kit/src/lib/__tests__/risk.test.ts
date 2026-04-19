import { describe, it, expect } from "vitest";
import { riskColor, riskColorBg, riskBarStyle } from "../risk";

describe("riskColor", () => {
  it("returns --danger for score >= 70", () => {
    expect(riskColor(70)).toBe("var(--danger)");
    expect(riskColor(100)).toBe("var(--danger)");
  });

  it("returns --warn for score >= 40 and < 70", () => {
    expect(riskColor(40)).toBe("var(--warn)");
    expect(riskColor(69)).toBe("var(--warn)");
  });

  it("returns --success for score < 40", () => {
    expect(riskColor(0)).toBe("var(--success)");
    expect(riskColor(39)).toBe("var(--success)");
  });
});

describe("riskColorBg", () => {
  it("returns a color-mix string with default 12% alpha", () => {
    const result = riskColorBg(80);
    expect(result).toBe("color-mix(in srgb, var(--danger) 12%, transparent)");
  });

  it("uses a custom alpha percentage", () => {
    const result = riskColorBg(50, 0.25);
    expect(result).toBe("color-mix(in srgb, var(--warn) 25%, transparent)");
  });

  it("uses the correct risk color based on score", () => {
    expect(riskColorBg(10)).toContain("var(--success)");
    expect(riskColorBg(50)).toContain("var(--warn)");
    expect(riskColorBg(90)).toContain("var(--danger)");
  });
});

describe("riskBarStyle", () => {
  it("returns width matching the score percentage", () => {
    const style = riskBarStyle(60);
    expect(style.width).toBe("60%");
  });

  it("computes opacity correctly for score 0", () => {
    const style = riskBarStyle(0);
    // opacity = 0.35 + (0/100) * 0.65 = 0.35
    expect(style.opacity).toBeCloseTo(0.35);
  });

  it("computes opacity correctly for score 100", () => {
    const style = riskBarStyle(100);
    // opacity = 0.35 + (100/100) * 0.65 = 1.0
    expect(style.opacity).toBeCloseTo(1.0);
  });

  it("computes opacity correctly for score 50", () => {
    const style = riskBarStyle(50);
    // opacity = 0.35 + (50/100) * 0.65 = 0.675
    expect(style.opacity).toBeCloseTo(0.675);
  });
});
