import { describe, it, expect, beforeEach } from "vitest";
import { retroStore } from "./retro-store";

describe("retro-store", () => {
  beforeEach(() => {
    retroStore.reset();
  });

  it("starts hidden and not seeded", () => {
    const s = retroStore.getState();
    expect(s.visible).toBe(false);
    expect(s.seeded).toBe(false);
  });

  it("toggle flips visibility", () => {
    retroStore.toggle();
    expect(retroStore.getState().visible).toBe(true);
    retroStore.toggle();
    expect(retroStore.getState().visible).toBe(false);
  });

  it("setVisible short-circuits when the value already matches", () => {
    let ticks = 0;
    const unsub = retroStore.subscribe(() => { ticks += 1; });
    retroStore.setVisible(false);
    expect(ticks).toBe(0);
    retroStore.setVisible(true);
    expect(ticks).toBe(1);
    retroStore.setVisible(true);
    expect(ticks).toBe(1);
    unsub();
  });

  it("markSeeded is latching (single emit)", () => {
    let ticks = 0;
    const unsub = retroStore.subscribe(() => { ticks += 1; });
    retroStore.markSeeded();
    retroStore.markSeeded();
    expect(ticks).toBe(1);
    expect(retroStore.getState().seeded).toBe(true);
    unsub();
  });
});
