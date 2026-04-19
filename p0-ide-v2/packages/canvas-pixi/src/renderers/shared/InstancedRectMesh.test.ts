import { describe, it, expect } from "vitest";
import {
  InstancedRectMesh,
  FLOATS_PER_INSTANCE,
  unpackHexInto,
} from "./InstancedRectMesh";

// These tests exercise the pure Float32Array math + capacity-growth logic of
// InstancedRectMesh. The Pixi Buffer/Geometry/Mesh/Shader objects it wraps do
// not need a live WebGL context just to be constructed — only `Application`
// does — so we can instantiate the mesh directly and verify:
//   - backing buffer sizing
//   - ensureCapacity() doubles until n ≤ capacity
//   - view() guard after destroy()
//   - unpackHexInto writes RGBA in the documented layout

describe("FLOATS_PER_INSTANCE", () => {
  it("is 14 — position(2) + size(2) + fill(4) + border(4) + bw/radius(2)", () => {
    expect(FLOATS_PER_INSTANCE).toBe(14);
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

  it("honours the offset — preserves bytes written earlier", () => {
    const out = new Float32Array(8);
    out[0] = 9; out[1] = 9; out[2] = 9; out[3] = 9;
    unpackHexInto(0x000000, out, 4, 1);
    expect(out[0]).toBe(9);
    expect(out[4]).toBe(0);
    expect(out[7]).toBe(1);
  });
});

describe("InstancedRectMesh constructor", () => {
  it("allocates FLOATS_PER_INSTANCE × capacity floats at initial capacity", () => {
    const m = new InstancedRectMesh(64);
    expect(m.view().length).toBe(64 * FLOATS_PER_INSTANCE);
    m.destroy();
  });

  it("clamps initialCapacity to a minimum of 16", () => {
    const m = new InstancedRectMesh(1);
    expect(m.view().length).toBe(16 * FLOATS_PER_INSTANCE);
    m.destroy();
  });
});

describe("InstancedRectMesh.ensureCapacity", () => {
  it("is a no-op when n ≤ current capacity", () => {
    const m = new InstancedRectMesh(32);
    const before = m.view();
    m.ensureCapacity(32);
    expect(m.view()).toBe(before); // same Float32Array reference
    m.destroy();
  });

  it("doubles in power-of-two steps until n ≤ capacity", () => {
    const m = new InstancedRectMesh(16);
    m.ensureCapacity(100); // 16 → 32 → 64 → 128
    expect(m.view().length).toBe(128 * FLOATS_PER_INSTANCE);
    m.destroy();
  });

  it("grows from the documented default (1024) to a value containing n", () => {
    const m = new InstancedRectMesh(); // default 1024
    m.ensureCapacity(1500); // 1024 → 2048
    expect(m.view().length).toBe(2048 * FLOATS_PER_INSTANCE);
    m.destroy();
  });
});

describe("InstancedRectMesh writes at the documented layout", () => {
  it("writing at offset i × FLOATS_PER_INSTANCE is visible through view()", () => {
    const m = new InstancedRectMesh(16);
    const data = m.view();
    // Write instance 2 — position (11, 22), size (33, 44).
    const o = 2 * FLOATS_PER_INSTANCE;
    data[o] = 11;
    data[o + 1] = 22;
    data[o + 2] = 33;
    data[o + 3] = 44;
    const reread = m.view();
    expect(reread[o]).toBe(11);
    expect(reread[o + 1]).toBe(22);
    expect(reread[o + 2]).toBe(33);
    expect(reread[o + 3]).toBe(44);
    m.destroy();
  });
});

describe("InstancedRectMesh.destroy", () => {
  it("view() throws after destroy()", () => {
    const m = new InstancedRectMesh(16);
    m.destroy();
    expect(() => m.view()).toThrow(/after destroy/);
  });
});
