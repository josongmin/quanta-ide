import { beforeEach, describe, expect, it } from "vitest";
import { tierStore } from "./store";
import { LEAF_WORLD_WIDTH } from "@quanta/canvas-engine";

// tierStore — apparent-size auto-flip behaviour
// --------------------------------------------------------------------
// `setScale` is the hot path for pinch/wheel zoom. The contract is:
//   - Stays inside the current tier's [minApparentPx, maxApparentPx)
//     band (as computed from leafWorldSize × scale): no tier change,
//     scale updates only.
//   - Crosses out of the band: re-resolve activeTier via the ladder.
// Explicit scope state (anchor / selection) is NEVER touched here —
// that was the root of the 2026-04-21 regression that motivated
// removing auto-flip originally.
//
// Reference math: `LEAF_WORLD_WIDTH = 560`. So scale * 560 = apparent
// pixels of one file card. For the Building band [80, 400) px, that's
// scale [≈0.143, ≈0.714). For Street [20, 80) → scale [≈0.036, ≈0.143).

const APPARENT = (scale: number) => LEAF_WORLD_WIDTH * scale;

describe("tierStore.setScale auto-flip", () => {
  beforeEach(() => {
    tierStore.reset();
  });

  it("holds tier steady while scale stays inside the current band", () => {
    tierStore.jumpToTier("city"); // Building band [80, 400) px
    const startTier = tierStore.getState().activeTier.name;
    // Scales inside Building → apparent px in [80, 400)
    tierStore.setScale(0.2); // → ≈112px — inside
    expect(tierStore.getState().activeTier.name).toBe(startTier);
    tierStore.setScale(0.5); // → 280px — still inside
    expect(tierStore.getState().activeTier.name).toBe(startTier);
  });

  it("flips tier down when apparent size drops below the current band", () => {
    tierStore.jumpToTier("city"); // Building [80, 400) px
    tierStore.setScale(0.1); // → 56px — below Building, inside Street [20, 80)
    expect(tierStore.getState().activeTier.visibleKind).toBe("street");
  });

  it("flips tier up when apparent size crosses into an inner band", () => {
    tierStore.jumpToTier("universe"); // Universe [0, 4) px
    tierStore.setScale(0.05); // → 28px — Street [20, 80)
    expect(tierStore.getState().activeTier.visibleKind).toBe("street");
  });

  it("walks tiers across multiple band crossings", () => {
    tierStore.jumpToTier("universe");
    tierStore.setScale(0.02); // → 11.2px — Galaxy [4, 20)
    expect(tierStore.getState().activeTier.visibleKind).toBe("galaxy");
    tierStore.setScale(0.1); // → 56px — Street
    expect(tierStore.getState().activeTier.visibleKind).toBe("street");
    tierStore.setScale(0.3); // → 168px — Building
    expect(tierStore.getState().activeTier.visibleKind).toBe("building");
    tierStore.setScale(1.0); // → 560px — Floor [400, 1600)
    expect(tierStore.getState().activeTier.visibleKind).toBe("floor");
    tierStore.setScale(4.0); // → 2240px — Room [1600, ∞)
    expect(tierStore.getState().activeTier.visibleKind).toBe("room");
  });

  it("ignores duplicate scale writes", () => {
    tierStore.jumpToTier("city");
    tierStore.setScale(0.3);
    let emits = 0;
    const unsub = tierStore.subscribe(() => {
      emits += 1;
    });
    tierStore.setScale(0.3); // same — should not emit
    tierStore.setScale(0.4); // different — should emit
    unsub();
    expect(emits).toBe(1);
  });

  it("setLeafWorldSize re-resolves the active tier at the current scale", () => {
    // If the leaf size were to change (future work: per-language sizing),
    // the tier pill must reflect the new apparent-px immediately.
    tierStore.setScale(0.5); // With default LEAF=560 → 280px → Building
    expect(tierStore.getState().activeTier.visibleKind).toBe("building");
    tierStore.setLeafWorldSize(LEAF_WORLD_WIDTH / 10); // 56px → Street
    expect(tierStore.getState().activeTier.visibleKind).toBe("street");
  });

  it("apparent-px math is consistent: jumpToTier lands mid-band", () => {
    tierStore.jumpToTier("city"); // Building mid = (80+400)/2 = 240px
    const s = tierStore.getState();
    expect(APPARENT(s.scale)).toBeCloseTo(240, 3);
  });
});
