import { describe, it, expect, beforeEach } from "vitest";
import {
  FEATURE_PRESETS,
  PRESET_BY_ID,
  applyPreset,
  inferActivePreset,
  listPresets,
  resolvePresetFeatureSet,
} from "./feature-presets";
import { FEATURE_REGISTRY } from "./feature-registry";
import { featureFlagsStore } from "../store/feature-flags-store";

describe("feature-presets", () => {
  beforeEach(() => {
    featureFlagsStore.resetToDefaults();
  });

  it("exports all seven U2 presets", () => {
    const ids = FEATURE_PRESETS.map(p => p.id).sort();
    expect(ids).toEqual([
      "architect",
      "collab-live",
      "demo",
      "minimal",
      "onboarding",
      "perf-audit",
      "reviewer",
    ]);
  });

  it("orders presets via listPresets()", () => {
    const ordered = listPresets();
    const orders = ordered.map(p => p.order);
    const sorted = [...orders].sort((a, b) => a - b);
    expect(orders).toEqual(sorted);
  });

  it("resolvePresetFeatureSet expands `overlay.*` to zero features today", () => {
    const preset = PRESET_BY_ID.get("minimal");
    expect(preset).toBeDefined();
    const resolved = resolvePresetFeatureSet(preset!);
    // No overlay.* features exist in the registry yet.
    for (const id of resolved) {
      expect(id.startsWith("overlay.")).toBe(false);
    }
    expect(resolved.has("power.commandPalette")).toBe(true);
  });

  it("resolvePresetFeatureSet expands `*` to every stable|beta feature", () => {
    const demo = PRESET_BY_ID.get("demo");
    expect(demo).toBeDefined();
    const resolved = resolvePresetFeatureSet(demo!);
    for (const f of FEATURE_REGISTRY) {
      if (f.maturity === "stable" || f.maturity === "beta") {
        expect(resolved.has(f.id)).toBe(true);
      } else {
        // Experimental features must stay out of the demo preset.
        expect(resolved.has(f.id)).toBe(false);
      }
    }
  });

  it("applyPreset enables exactly the resolved set and disables everything else", () => {
    applyPreset("reviewer");
    const resolved = resolvePresetFeatureSet(PRESET_BY_ID.get("reviewer")!);
    const flags = featureFlagsStore.getState().flags;
    for (const f of FEATURE_REGISTRY) {
      expect(flags[f.id]).toBe(resolved.has(f.id));
    }
  });

  it("inferActivePreset returns the preset id after applyPreset", () => {
    applyPreset("architect");
    expect(inferActivePreset()).toBe("architect");
    applyPreset("minimal");
    expect(inferActivePreset()).toBe("minimal");
  });

  it("inferActivePreset returns null when a flag diverges from the preset", () => {
    applyPreset("reviewer");
    // Flip one feature to break the match.
    const target = FEATURE_REGISTRY.find(f => f.id === "ai.repoTour");
    expect(target).toBeDefined();
    featureFlagsStore.setFlag(target!.id, !featureFlagsStore.getState().flags[target!.id]);
    expect(inferActivePreset()).toBeNull();
  });

  it("applyPreset is a no-op for unknown ids", () => {
    const before = { ...featureFlagsStore.getState().flags };
    applyPreset("does-not-exist");
    const after = featureFlagsStore.getState().flags;
    expect(after).toEqual(before);
  });
});
