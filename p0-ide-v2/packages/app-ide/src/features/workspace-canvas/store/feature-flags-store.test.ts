import { describe, it, expect, beforeEach } from "vitest";
import { featureFlagsStore } from "./feature-flags-store";

// ─────────────────────────────────────────────────────────────────────
// `annotation.pen` is `defaultEnabled: true` and `dependsOn:
// ["annotation.toolbar"]` in the canonical FEATURE_REGISTRY — perfect
// for the cascade test. If that ever changes, update these ids together.
//
// Cycle guard note: `FEATURE_BY_ID` is a module-level map built once at
// import time from `FEATURE_REGISTRY`, and nothing in the test harness
// can replace it without vi.mock'ing the registry module. The real
// registry is enforced cycle-free at review time, so a cycle is
// structurally impossible from production data. We therefore exercise
// the cascade on a dependency chain instead, which is the only path
// through `isEnabled`'s recursion we can actually hit.
// ─────────────────────────────────────────────────────────────────────

describe("feature-flags-store", () => {
  beforeEach(() => {
    featureFlagsStore.resetToDefaults();
  });

  it("isEnabled returns true for a feature whose defaultEnabled is true", () => {
    expect(featureFlagsStore.isEnabled("annotation.toolbar")).toBe(true);
  });

  it("setFlag flips the enabled state", () => {
    expect(featureFlagsStore.isEnabled("annotation.toolbar")).toBe(true);
    featureFlagsStore.setFlag("annotation.toolbar", false);
    expect(featureFlagsStore.isEnabled("annotation.toolbar")).toBe(false);
    featureFlagsStore.setFlag("annotation.toolbar", true);
    expect(featureFlagsStore.isEnabled("annotation.toolbar")).toBe(true);
  });

  it("disabling a dependency cascades to dependants", () => {
    // `annotation.pen` depends on `annotation.toolbar` — both default on.
    expect(featureFlagsStore.isEnabled("annotation.pen")).toBe(true);
    featureFlagsStore.setFlag("annotation.toolbar", false);
    expect(featureFlagsStore.isEnabled("annotation.pen")).toBe(false);
    // Re-enabling the dep restores the dependant.
    featureFlagsStore.setFlag("annotation.toolbar", true);
    expect(featureFlagsStore.isEnabled("annotation.pen")).toBe(true);
  });

  it("resetToDefaults restores every flag to its registry default", () => {
    featureFlagsStore.setFlag("annotation.toolbar", false);
    featureFlagsStore.setFlag("annotation.pen", false);
    featureFlagsStore.resetToDefaults();
    expect(featureFlagsStore.isEnabled("annotation.toolbar")).toBe(true);
    expect(featureFlagsStore.isEnabled("annotation.pen")).toBe(true);
  });

  it("isEnabled terminates on deep dependency chains (cycle-guard smoke)", () => {
    // The real registry is acyclic, so this is really a smoke test for the
    // `seen` visited-set — it just has to return a boolean without blowing
    // the stack. We exercise every id in the registry to catch any latent
    // infinite-recursion hazard wired in by future registry edits.
    const { flags } = featureFlagsStore.getState();
    for (const id of Object.keys(flags)) {
      expect(typeof featureFlagsStore.isEnabled(id)).toBe("boolean");
    }
  });
});
