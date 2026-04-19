import { describe, it, expect } from "vitest";
import { uxSettingsStore } from "./ux-settings-store";

describe("ux-settings-store", () => {
  it("starts from sensible defaults", () => {
    const s = uxSettingsStore.getState();
    expect(s.showStickies).toBe(true);
    expect(s.showHeatmap).toBe(true);
    expect(s.showGridBg).toBe(true);
    expect(s.showHitLayers).toBe(false);
    expect(s.autoSyncUrl).toBe(false);
  });

  it("setters flip flags and restore them", () => {
    uxSettingsStore.setShowStickies(false);
    uxSettingsStore.setShowHeatmap(false);
    uxSettingsStore.setShowGridBg(false);
    uxSettingsStore.setShowHitLayers(true);
    uxSettingsStore.setAutoSyncUrl(true);
    const s = uxSettingsStore.getState();
    expect(s.showStickies).toBe(false);
    expect(s.showHeatmap).toBe(false);
    expect(s.showGridBg).toBe(false);
    expect(s.showHitLayers).toBe(true);
    expect(s.autoSyncUrl).toBe(true);
    // restore for later tests
    uxSettingsStore.setShowStickies(true);
    uxSettingsStore.setShowHeatmap(true);
    uxSettingsStore.setShowGridBg(true);
    uxSettingsStore.setShowHitLayers(false);
    uxSettingsStore.setAutoSyncUrl(false);
  });

  it("setters short-circuit on unchanged value", () => {
    let ticks = 0;
    const unsub = uxSettingsStore.subscribe(() => { ticks += 1; });
    uxSettingsStore.setShowStickies(uxSettingsStore.getState().showStickies);
    uxSettingsStore.setShowHeatmap(uxSettingsStore.getState().showHeatmap);
    uxSettingsStore.setAutoSyncUrl(uxSettingsStore.getState().autoSyncUrl);
    expect(ticks).toBe(0);
    unsub();
  });

  it("subscribers fire exactly once per real change", () => {
    let ticks = 0;
    const unsub = uxSettingsStore.subscribe(() => { ticks += 1; });
    const start = uxSettingsStore.getState().showHitLayers;
    uxSettingsStore.setShowHitLayers(!start);
    uxSettingsStore.setShowHitLayers(start);
    expect(ticks).toBe(2);
    unsub();
  });
});
