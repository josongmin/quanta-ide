import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Fresh uiBus per test.
// ---------------------------------------------------------------------------

async function freshBus() {
  const mod = await import("../ui-bus/ui-bus");
  return mod.uiBus;
}

describe("uiBus", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("togglePalette flips paletteOpen state", async () => {
    const bus = await freshBus();
    expect(bus.get().paletteOpen).toBe(false);
    bus.togglePalette();
    expect(bus.get().paletteOpen).toBe(true);
    bus.togglePalette();
    expect(bus.get().paletteOpen).toBe(false);
  });

  it("togglePalette accepts an explicit open value", async () => {
    const bus = await freshBus();
    bus.togglePalette(true);
    expect(bus.get().paletteOpen).toBe(true);
    bus.togglePalette(true);
    // Still true — not toggled.
    expect(bus.get().paletteOpen).toBe(true);
    bus.togglePalette(false);
    expect(bus.get().paletteOpen).toBe(false);
  });

  it("closeAll resets every open flag to false", async () => {
    const bus = await freshBus();
    bus.togglePalette(true);
    bus.toggleDevConsole(true);
    bus.toggleHub(true);
    bus.toggleRules(true);
    bus.toggleSettings(true);

    const before = bus.get();
    expect(before.paletteOpen).toBe(true);
    expect(before.devConsoleOpen).toBe(true);
    expect(before.hubOpen).toBe(true);
    expect(before.rulesOpen).toBe(true);
    expect(before.settingsOpen).toBe(true);

    bus.closeAll();

    const after = bus.get();
    expect(after.paletteOpen).toBe(false);
    expect(after.devConsoleOpen).toBe(false);
    expect(after.hubOpen).toBe(false);
    expect(after.rulesOpen).toBe(false);
    expect(after.settingsOpen).toBe(false);
  });

  it("subscribe notifies on every state change", async () => {
    const bus = await freshBus();
    const listener = vi.fn();
    bus.subscribe(listener);

    bus.togglePalette();
    expect(listener).toHaveBeenCalledTimes(1);

    bus.toggleSettings(true);
    expect(listener).toHaveBeenCalledTimes(2);

    bus.closeAll();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("unsubscribe stops further notifications", async () => {
    const bus = await freshBus();
    const listener = vi.fn();
    const unsub = bus.subscribe(listener);

    bus.togglePalette();
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    bus.togglePalette();
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("toggleDevConsole flips devConsoleOpen state", async () => {
    const bus = await freshBus();
    expect(bus.get().devConsoleOpen).toBe(false);
    bus.toggleDevConsole();
    expect(bus.get().devConsoleOpen).toBe(true);
  });

  it("toggleSettings flips settingsOpen state", async () => {
    const bus = await freshBus();
    bus.toggleSettings();
    expect(bus.get().settingsOpen).toBe(true);
    bus.toggleSettings();
    expect(bus.get().settingsOpen).toBe(false);
  });

  it("selectFeature sets the selectedFeatureId", async () => {
    const bus = await freshBus();
    expect(bus.get().selectedFeatureId).toBeUndefined();
    bus.selectFeature("my-feature");
    expect(bus.get().selectedFeatureId).toBe("my-feature");
    bus.selectFeature(undefined);
    expect(bus.get().selectedFeatureId).toBeUndefined();
  });
});
