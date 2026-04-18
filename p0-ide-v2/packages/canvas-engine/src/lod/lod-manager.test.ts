import { describe, it, expect, beforeEach } from "vitest";
import { LodManager, lodFromScale } from "./lod-manager";

// Hysteresis thresholds copied verbatim from lod-config.ts. Keeping them
// duplicated here is intentional — the test pins the *contract* so any
// future tweak to the LOD ladder forces a corresponding update to these
// expectations (which is what we want for a regression suite).
//
// Thresholds retuned 2026-04-19 — shifted ~25% earlier so tier upgrades
// trigger sooner on zoom-in. Adjacent tiers now share handoff points in
// the lower ladder (city.down=galaxy.up=0.10, galaxy.down=supergalaxy.up=0.07,
// supergalaxy.down=universe.up=0.03).
// The naming convention A_B is "scale at which we transition between
// adjacent tiers A↔B". For UP: the upThreshold of the FINER tier (B).
// For DOWN: the downThreshold of the FINER tier (B) — when we're in the
// finer tier and drop below that, we fall back to the coarser tier (A).
const UP = {
  universe_supergalaxy: 0.07,   // supergalaxy.upThreshold
  supergalaxy_galaxy:   0.10,   // galaxy.upThreshold
  galaxy_city:          0.13,   // city.upThreshold
  city_street:          0.25,
  street_ground:        0.60,
};
const DOWN = {
  universe_supergalaxy: 0.015,  // supergalaxy.downThreshold (widened for user)
  supergalaxy_galaxy:   0.07,   // galaxy.downThreshold
  galaxy_city:          0.10,   // city.downThreshold
  city_street:          0.22,
  street_ground:        0.57,
};

describe("LodManager", () => {
  let m: LodManager;
  // Reset between tests so we never leak the hysteretic `current` across
  // cases — LodManager is stateful, which is the whole point of the test.
  beforeEach(() => { m = new LodManager(); });

  describe("default state", () => {
    it("starts in galaxy", () => {
      expect(m.get()).toBe("galaxy");
    });
  });

  describe("zoom up (scale increases)", () => {
    it("galaxy → city at UP threshold", () => {
      expect(m.update(UP.galaxy_city)).toBe("city");
    });

    it("city → street at UP threshold", () => {
      m.update(UP.galaxy_city);       // → city
      expect(m.update(UP.city_street)).toBe("street");
    });

    it("street → ground at UP threshold", () => {
      m.update(UP.galaxy_city);
      m.update(UP.city_street);
      expect(m.update(UP.street_ground)).toBe("ground");
    });

    it("walks all five tiers up in order", () => {
      // Start from deepest LOD, walk up every tier.
      m.reset("universe");
      expect(m.update(UP.universe_supergalaxy)).toBe("supergalaxy");
      expect(m.update(UP.supergalaxy_galaxy)).toBe("galaxy");
      expect(m.update(UP.galaxy_city)).toBe("city");
      expect(m.update(UP.city_street)).toBe("street");
      expect(m.update(UP.street_ground)).toBe("ground");
    });
  });

  describe("zoom down (scale decreases)", () => {
    it("galaxy → supergalaxy at DOWN threshold", () => {
      // Drop just under DOWN threshold.
      expect(m.update(DOWN.supergalaxy_galaxy - 0.001)).toBe("supergalaxy");
    });

    it("supergalaxy → universe at DOWN threshold", () => {
      m.update(DOWN.supergalaxy_galaxy - 0.001);
      expect(m.update(DOWN.universe_supergalaxy - 0.001)).toBe("universe");
    });

    it("walks all five tiers down in order", () => {
      // Start from closest LOD, walk down every tier.
      m.reset("ground");
      expect(m.update(DOWN.street_ground - 0.001)).toBe("street");
      expect(m.update(DOWN.city_street - 0.001)).toBe("city");
      expect(m.update(DOWN.galaxy_city - 0.001)).toBe("galaxy");
      expect(m.update(DOWN.supergalaxy_galaxy - 0.001)).toBe("supergalaxy");
      expect(m.update(DOWN.universe_supergalaxy - 0.001)).toBe("universe");
    });
  });

  describe("hysteresis", () => {
    // Crux of the manager: once we transition, we do NOT transition back
    // until the scale crosses the opposite threshold. A value between UP
    // and DOWN should be a no-op.
    it("stays in galaxy within dead band above UP(supergalaxy→galaxy)", () => {
      expect(m.update(UP.galaxy_city - 0.001)).toBe("galaxy");
      expect(m.update(DOWN.galaxy_city + 0.001)).toBe("galaxy");
    });

    it("stays in city within dead band", () => {
      m.update(UP.galaxy_city); // → city
      // Dead band: below UP.city_street but above DOWN.galaxy_city.
      expect(m.update(UP.city_street - 0.001)).toBe("city");
      expect(m.update(DOWN.galaxy_city + 0.001)).toBe("city");
    });
  });

  describe("rapid jumps across multiple tiers", () => {
    // Large scale jumps should cascade — e.g. jumping from universe to
    // ground in a single update should walk all the way up. We inspect
    // final state only; intermediate transitions are implementation
    // detail.
    it("universe → ground in one update walks the full ladder", () => {
      m.reset("universe");
      // Because `update` contains cascading `if`s rather than `else if`,
      // a single call can walk multiple tiers. This asserts that
      // property.
      const final = m.update(UP.street_ground + 0.1);
      expect(final).toBe("ground");
    });

    it("ground → universe in one update walks the full ladder", () => {
      m.reset("ground");
      const final = m.update(DOWN.universe_supergalaxy - 0.001);
      expect(final).toBe("universe");
    });
  });

  describe("reset", () => {
    it("reset() defaults to galaxy", () => {
      m.update(UP.street_ground + 0.1); // → ground
      m.reset();
      expect(m.get()).toBe("galaxy");
    });

    it("reset(level) jumps to the specified level", () => {
      m.reset("supergalaxy");
      expect(m.get()).toBe("supergalaxy");
      m.reset("universe");
      expect(m.get()).toBe("universe");
      m.reset("ground");
      expect(m.get()).toBe("ground");
    });

    it("reset mid-session preserves hysteresis on subsequent updates", () => {
      // After reset, the manager still applies the normal ladder.
      m.reset("city");
      expect(m.update(DOWN.galaxy_city + 0.001)).toBe("city");
      expect(m.update(DOWN.galaxy_city - 0.001)).toBe("galaxy");
    });
  });
});

describe("lodFromScale (stateless)", () => {
  // Stateless lookup — must agree with the LodManager ladder at the UP
  // boundaries. Used by code paths that don't carry state (e.g. initial
  // render before the manager has seen a scale).
  it("maps each UP threshold to its tier", () => {
    expect(lodFromScale(UP.street_ground)).toBe("ground");
    expect(lodFromScale(UP.city_street)).toBe("street");
    expect(lodFromScale(UP.galaxy_city)).toBe("city");
    expect(lodFromScale(UP.supergalaxy_galaxy)).toBe("galaxy");
    expect(lodFromScale(UP.universe_supergalaxy)).toBe("supergalaxy");
    expect(lodFromScale(0)).toBe("universe");
  });

  it("returns universe for very small scales", () => {
    expect(lodFromScale(0.001)).toBe("universe");
  });

  it("returns ground for very large scales", () => {
    expect(lodFromScale(100)).toBe("ground");
  });
});
