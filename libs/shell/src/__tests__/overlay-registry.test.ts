import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ComponentType } from "react";

// ---------------------------------------------------------------------------
// Fresh registry per test via vi.resetModules() + dynamic import.
// ---------------------------------------------------------------------------

async function freshRegistry() {
  const mod = await import("../overlay-registry");
  return mod.overlayRegistry;
}

const FakeOverlayA: ComponentType = () => null;
const FakeOverlayB: ComponentType = () => null;

describe("overlayRegistry", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("register + getAll returns the registered component", async () => {
    const reg = await freshRegistry();
    reg.register("a", FakeOverlayA);
    const all = reg.getAll();
    expect(all).toHaveLength(1);
    expect(all[0]).toBe(FakeOverlayA);
  });

  it("disposer removes the component", async () => {
    const reg = await freshRegistry();
    const dispose = reg.register("a", FakeOverlayA);
    expect(reg.getAll()).toHaveLength(1);
    dispose();
    expect(reg.getAll()).toHaveLength(0);
  });

  it("multiple overlays coexist", async () => {
    const reg = await freshRegistry();
    reg.register("a", FakeOverlayA);
    reg.register("b", FakeOverlayB);
    const all = reg.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(FakeOverlayA);
    expect(all).toContain(FakeOverlayB);
  });

  it("subscribe notifies on register and unregister", async () => {
    const reg = await freshRegistry();
    const listener = vi.fn();
    reg.subscribe(listener);

    reg.register("a", FakeOverlayA);
    expect(listener).toHaveBeenCalledTimes(1);

    const dispose = reg.register("b", FakeOverlayB);
    expect(listener).toHaveBeenCalledTimes(2);

    dispose();
    expect(listener).toHaveBeenCalledTimes(3);
  });

  it("unsubscribe stops notifications", async () => {
    const reg = await freshRegistry();
    const listener = vi.fn();
    const unsub = reg.subscribe(listener);

    reg.register("x", FakeOverlayA);
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    reg.register("y", FakeOverlayB);
    // Listener should NOT have been called again.
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
