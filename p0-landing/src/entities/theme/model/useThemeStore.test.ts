import { describe, it, expect, beforeEach } from "vitest";
import { useThemeStore } from "./useThemeStore";

describe("useThemeStore", () => {
  beforeEach(() => {
    useThemeStore.setState({ aurora: "violet" });
  });

  it("has correct initial aurora", () => {
    expect(useThemeStore.getState().aurora).toBe("violet");
  });

  it("changes aurora preset", () => {
    useThemeStore.getState().setAurora("ocean");
    expect(useThemeStore.getState().aurora).toBe("ocean");
  });
});
