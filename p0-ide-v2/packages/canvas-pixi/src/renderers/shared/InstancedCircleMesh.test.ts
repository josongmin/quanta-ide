import { describe, it, expect } from "vitest";
import {
  InstancedCircleMesh,
  FLOATS_PER_CIRCLE_INSTANCE,
  unpackHexInto,
} from "./InstancedCircleMesh";

// These tests exercise the pure Float32Array math + capacity-growth logic
// of InstancedCircleMesh. The Pixi Buffer/Geometry/Mesh/Shader objects it
// wraps do not need a live WebGL context just to be constructed (only
// `Application` does), so we can instantiate the mesh directly and verify
// the backing buffer schema + the pulse-phase hot-path writer.

describe("FLOATS_PER_CIRCLE_INSTANCE", () => {
  it("is 14 — centre(2) + radii(2) + color(4) + border(4) + bw(1) + pulse(1)", () => {
    expect(FLOATS_PER_CIRCLE_INSTANCE).toBe(14);
  });
});

describe("unpackHexInto", () => {
  it("writes RGB from 0xRRGGBB + the supplied alpha", () => {
    const out = new Float32Array(4);
    unpackHexInto(0xff8040, out, 0, 0.5);
    expect(out[0]).toBeCloseTo(255 / 255, 6);
    expect(out[1]).toBeCloseTo(128 / 255, 6);
    expect(out[2]).toBeCloseTo(64 / 255, 6);
    expect(out[3]).toBe(0.5);
  });
});

describe("InstancedCircleMesh constructor", () => {
  it("allocates FLOATS_PER_CIRCLE_INSTANCE × capacity floats at initial capacity", () => {
    const m = new InstancedCircleMesh(32);
    expect(m.view().length).toBe(32 * FLOATS_PER_CIRCLE_INSTANCE);
    m.destroy();
  });

  it("clamps initialCapacity to a minimum of 16", () => {
    const m = new InstancedCircleMesh(1);
    expect(m.view().length).toBe(16 * FLOATS_PER_CIRCLE_INSTANCE);
    m.destroy();
  });
});

describe("InstancedCircleMesh.ensureCapacity", () => {
  it("is a no-op when n ≤ current capacity", () => {
    const m = new InstancedCircleMesh(32);
    const before = m.view();
    m.ensureCapacity(32);
    expect(m.view()).toBe(before);
    m.destroy();
  });

  it("doubles in power-of-two steps until n ≤ capacity", () => {
    const m = new InstancedCircleMesh(16);
    m.ensureCapacity(100); // 16 → 32 → 64 → 128
    expect(m.view().length).toBe(128 * FLOATS_PER_CIRCLE_INSTANCE);
    m.destroy();
  });
});

describe("InstancedCircleMesh writes at the documented layout", () => {
  it("centre, radii, colors and pulse land at the right offsets", () => {
    const m = new InstancedCircleMesh(4);
    const data = m.view();
    const o = 1 * FLOATS_PER_CIRCLE_INSTANCE;
    // centre
    data[o] = 10;
    data[o + 1] = 20;
    // outer radius
    data[o + 2] = 7;
    // inner radius
    data[o + 3] = 4;
    // fill rgba
    unpackHexInto(0x112233, data, o + 4, 0.5);
    // border rgba
    unpackHexInto(0xaabbcc, data, o + 8, 1);
    // border width
    data[o + 12] = 1.5;
    // pulse
    data[o + 13] = 0.25;

    expect(data[o]).toBe(10);
    expect(data[o + 2]).toBe(7);
    expect(data[o + 3]).toBe(4);
    expect(data[o + 4]).toBeCloseTo(0x11 / 255, 6);
    expect(data[o + 7]).toBe(0.5);
    expect(data[o + 8]).toBeCloseTo(0xaa / 255, 6);
    expect(data[o + 11]).toBe(1);
    expect(data[o + 12]).toBe(1.5);
    expect(data[o + 13]).toBe(0.25);
    m.destroy();
  });
});

describe("InstancedCircleMesh.updatePulsePhase", () => {
  it("writes the pulse slot for every live instance without touching others", () => {
    const m = new InstancedCircleMesh(4);
    const data = m.view();
    // Pre-populate all slots with distinct sentinels so we can prove the
    // pulse write only touches the last float per instance row.
    for (let i = 0; i < 3; i++) {
      const o = i * FLOATS_PER_CIRCLE_INSTANCE;
      for (let k = 0; k < FLOATS_PER_CIRCLE_INSTANCE; k++) {
        data[o + k] = k + 1;
      }
    }
    m.updatePulsePhase(3, 0.42);

    for (let i = 0; i < 3; i++) {
      const o = i * FLOATS_PER_CIRCLE_INSTANCE;
      // All non-pulse slots intact.
      for (let k = 0; k < 13; k++) {
        expect(data[o + k]).toBe(k + 1);
      }
      expect(data[o + 13]).toBeCloseTo(0.42, 6);
    }
    m.destroy();
  });

  it("no-op when count is zero", () => {
    const m = new InstancedCircleMesh(4);
    const data = m.view();
    data[13] = 9;
    m.updatePulsePhase(0, 0.5);
    expect(data[13]).toBe(9);
    m.destroy();
  });
});

describe("InstancedCircleMesh.destroy", () => {
  it("view() throws after destroy()", () => {
    const m = new InstancedCircleMesh(16);
    m.destroy();
    expect(() => m.view()).toThrow(/after destroy/);
  });
});
