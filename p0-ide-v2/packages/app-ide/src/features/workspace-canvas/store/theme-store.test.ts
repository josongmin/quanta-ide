import { describe, it, expect, beforeEach } from "vitest";
import { themeStore, THEMES } from "./theme-store";

describe("theme-store", () => {
  beforeEach(() => {
    themeStore.setTheme("dark");
  });

  it("starts from a known default", () => {
    expect(themeStore.getState().theme).toBe("dark");
  });

  it("setTheme updates state", () => {
    themeStore.setTheme("light");
    expect(themeStore.getState().theme).toBe("light");
  });

  it("cycle advances through the three themes in order", () => {
    themeStore.setTheme(THEMES[0]!);
    themeStore.cycle();
    expect(themeStore.getState().theme).toBe(THEMES[1]);
    themeStore.cycle();
    expect(themeStore.getState().theme).toBe(THEMES[2]);
    themeStore.cycle();
    expect(themeStore.getState().theme).toBe(THEMES[0]);
  });

  it("setTheme is a no-op when value does not change", () => {
    let ticks = 0;
    const unsubscribe = themeStore.subscribe(() => { ticks += 1; });
    themeStore.setTheme("dark");
    themeStore.setTheme("dark");
    unsubscribe();
    expect(ticks).toBe(0);
  });
});
