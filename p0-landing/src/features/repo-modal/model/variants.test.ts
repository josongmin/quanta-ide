import { describe, it, expect } from "vitest";
import { EASE_SMOOTH, MODAL_FADE, MODAL_SHELL, crossfade } from "./variants";

describe("animation variants", () => {
  it("EASE_SMOOTH is a 4-element tuple", () => {
    expect(EASE_SMOOTH).toHaveLength(4);
    for (const v of EASE_SMOOTH) {
      expect(typeof v).toBe("number");
    }
  });

  it("MODAL_FADE has required properties", () => {
    expect(MODAL_FADE).toHaveProperty("initial");
    expect(MODAL_FADE).toHaveProperty("animate");
    expect(MODAL_FADE).toHaveProperty("exit");
    expect(MODAL_FADE).toHaveProperty("transition");
  });

  it("MODAL_SHELL has required properties", () => {
    expect(MODAL_SHELL.transition).toHaveProperty("ease");
    expect(MODAL_SHELL.transition).toHaveProperty("duration");
  });

  it("crossfade has required properties", () => {
    expect(crossfade).toHaveProperty("initial");
    expect(crossfade).toHaveProperty("animate");
    expect(crossfade).toHaveProperty("exit");
  });
});
