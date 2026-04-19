import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Fresh store per test via dynamic import.
// ---------------------------------------------------------------------------

async function freshBus() {
  const mod = await import("../tab-bus/tab-bus");
  return mod.tabBus;
}

describe("tabBus", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("initial state has no pending request", async () => {
    const bus = await freshBus();
    expect(bus.get().pending).toBeNull();
  });

  it("open() sets a pending request with incremented id", async () => {
    const bus = await freshBus();
    bus.open("agent", "Agent Chat");
    const pending = bus.get().pending;
    expect(pending).not.toBeNull();
    expect(pending!.app).toBe("agent");
    expect(pending!.label).toBe("Agent Chat");
    expect(typeof pending!.id).toBe("number");
  });

  it("consume() returns the pending request and clears it", async () => {
    const bus = await freshBus();
    bus.open("pr", "PR #42");
    const req = bus.consume();
    expect(req).not.toBeNull();
    expect(req!.app).toBe("pr");
    expect(req!.label).toBe("PR #42");
    expect(bus.get().pending).toBeNull();
  });

  it("consume() returns null when nothing is pending", async () => {
    const bus = await freshBus();
    expect(bus.consume()).toBeNull();
  });

  it("subscribe notifies on open and consume", async () => {
    const bus = await freshBus();
    const listener = vi.fn();
    const unsub = bus.subscribe(listener);

    bus.open("ide", "main.ts");
    expect(listener).toHaveBeenCalledTimes(1);

    bus.consume();
    expect(listener).toHaveBeenCalledTimes(2);

    unsub();
    bus.open("agent", "Chat");
    // No further notifications after unsubscribe.
    expect(listener).toHaveBeenCalledTimes(2);
  });
});
