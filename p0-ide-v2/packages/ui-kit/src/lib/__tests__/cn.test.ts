import { describe, it, expect } from "vitest";
import { cn } from "../cn";

describe("cn", () => {
  it("joins multiple class strings with a space", () => {
    expect(cn("a", "b", "c")).toBe("a b c");
  });

  it("skips false values", () => {
    expect(cn("a", false, "b")).toBe("a b");
  });

  it("skips null values", () => {
    expect(cn("a", null, "b")).toBe("a b");
  });

  it("skips undefined values", () => {
    expect(cn("a", undefined, "b")).toBe("a b");
  });

  it("skips empty string values (falsy)", () => {
    expect(cn("a", "", "b")).toBe("a b");
  });

  it("returns empty string when called with no arguments", () => {
    expect(cn()).toBe("");
  });

  it("returns the string as-is for a single argument", () => {
    expect(cn("only")).toBe("only");
  });

  it("returns empty string when all arguments are falsy", () => {
    expect(cn(false, null, undefined, "")).toBe("");
  });
});
