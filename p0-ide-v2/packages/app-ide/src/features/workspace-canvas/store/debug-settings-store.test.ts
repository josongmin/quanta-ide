import { describe, it, expect } from "vitest";
import { debugSettingsStore } from "./debug-settings-store";

describe("debug-settings-store", () => {
  it("starts with hud open, lod auto, scene unfrozen", () => {
    const s = debugSettingsStore.getState();
    expect(typeof s.debugHudOpen).toBe("boolean");
    expect(s.forceLod).toBe("auto");
    expect(s.freezeScene).toBe(false);
  });

  it("toggleDebugHud flips the flag", () => {
    const before = debugSettingsStore.getState().debugHudOpen;
    debugSettingsStore.toggleDebugHud();
    expect(debugSettingsStore.getState().debugHudOpen).toBe(!before);
    debugSettingsStore.toggleDebugHud();
    expect(debugSettingsStore.getState().debugHudOpen).toBe(before);
  });

  it("setDebugHudOpen short-circuits on same value", () => {
    const before = debugSettingsStore.getState().debugHudOpen;
    let ticks = 0;
    const unsub = debugSettingsStore.subscribe(() => { ticks += 1; });
    debugSettingsStore.setDebugHudOpen(before);
    expect(ticks).toBe(0);
    unsub();
  });

  it("setForceLod updates lod; no-op when same", () => {
    debugSettingsStore.setForceLod("galaxy");
    expect(debugSettingsStore.getState().forceLod).toBe("galaxy");
    let ticks = 0;
    const unsub = debugSettingsStore.subscribe(() => { ticks += 1; });
    debugSettingsStore.setForceLod("galaxy");
    expect(ticks).toBe(0);
    unsub();
    debugSettingsStore.setForceLod("auto"); // restore
  });

  it("setFreezeScene updates freezeScene", () => {
    debugSettingsStore.setFreezeScene(true);
    expect(debugSettingsStore.getState().freezeScene).toBe(true);
    debugSettingsStore.setFreezeScene(false);
    expect(debugSettingsStore.getState().freezeScene).toBe(false);
  });
});
