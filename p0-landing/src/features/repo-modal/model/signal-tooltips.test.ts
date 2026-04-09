import { describe, it, expect } from "vitest";
import { getSignalTooltip } from "./signal-tooltips";

describe("getSignalTooltip", () => {
  it("returns matching tooltip for known signal", () => {
    const result = getSignalTooltip("14-file webhook chain");
    expect(result).toContain("HTTP callbacks");
  });

  it("is case insensitive", () => {
    expect(getSignalTooltip("RETRY loops")).toContain("idempotent");
  });

  it("returns default for unknown signal", () => {
    expect(getSignalTooltip("unknown-xyz")).toBe("Complexity indicator identified by static analysis");
  });

  it("matches partial keywords", () => {
    expect(getSignalTooltip("3 payment providers")).toContain("payment");
  });
});
