import { describe, it, expect } from "vitest";
import { clamp, lerp, mixHex, hexToCss, cssToHex } from "./math";

describe("clamp", () => {
  it("returns the value inside range", () => {
    expect(clamp(5, 0, 10)).toBe(5);
  });
  it("clamps below lower bound", () => {
    expect(clamp(-3, 0, 10)).toBe(0);
  });
  it("clamps above upper bound", () => {
    expect(clamp(42, 0, 10)).toBe(10);
  });
});

describe("lerp", () => {
  it("returns a at t=0", () => {
    expect(lerp(10, 20, 0)).toBe(10);
  });
  it("returns b at t=1", () => {
    expect(lerp(10, 20, 1)).toBe(20);
  });
  it("interpolates midpoint", () => {
    expect(lerp(0, 100, 0.5)).toBe(50);
  });
});

describe("mixHex", () => {
  it("returns colorA at t=0", () => {
    expect(mixHex(0xff0000, 0x00ff00, 0)).toBe(0xff0000);
  });
  it("returns colorB at t=1", () => {
    expect(mixHex(0xff0000, 0x00ff00, 1)).toBe(0x00ff00);
  });
  it("blends channels linearly", () => {
    expect(mixHex(0x000000, 0xffffff, 0.5)).toBe(0x808080);
  });
  it("clamps t to [0, 1]", () => {
    expect(mixHex(0x112233, 0x445566, -5)).toBe(0x112233);
    expect(mixHex(0x112233, 0x445566, 5)).toBe(0x445566);
  });
});

describe("hexToCss", () => {
  it("formats a full 6-digit hex string with #", () => {
    expect(hexToCss(0xff00aa)).toBe("#ff00aa");
  });
  it("left-pads with zeros", () => {
    expect(hexToCss(0x0000ff)).toBe("#0000ff");
  });
});

describe("cssToHex", () => {
  it("parses 6-digit hex", () => {
    expect(cssToHex("#abcdef")).toBe(0xabcdef);
  });
  it("parses 3-digit shorthand", () => {
    expect(cssToHex("#abc")).toBe(0xaabbcc);
  });
  it("handles missing hash", () => {
    expect(cssToHex("ff0000")).toBe(0xff0000);
  });
  it("returns 0 for invalid input", () => {
    expect(cssToHex("not-a-color")).toBe(0);
  });
});
