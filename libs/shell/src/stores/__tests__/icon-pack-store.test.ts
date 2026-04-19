import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// ---------------------------------------------------------------------------
// Provide a minimal localStorage stub on window, since jsdom in this
// environment does not expose the standard Storage API on window.
// ---------------------------------------------------------------------------

const store = new Map<string, string>();
const fakeStorage = {
  getItem: (k: string) => store.get(k) ?? null,
  setItem: (k: string, v: string) => { store.set(k, v); },
  removeItem: (k: string) => { store.delete(k); },
  clear: () => { store.clear(); },
  get length() { return store.size; },
  key: (_i: number) => null,
};

const originalDescriptor = Object.getOwnPropertyDescriptor(window, "localStorage");

// ---------------------------------------------------------------------------
// Fresh store per test via dynamic import.
// ---------------------------------------------------------------------------

async function freshStore() {
  const mod = await import("../icon-pack-store/icon-pack-store");
  return mod.iconPackStore;
}

describe("iconPackStore", () => {
  beforeEach(() => {
    store.clear();
    vi.resetModules();
    Object.defineProperty(window, "localStorage", {
      value: fakeStorage,
      writable: true,
      configurable: true,
    });
  });

  afterEach(() => {
    if (originalDescriptor) {
      Object.defineProperty(window, "localStorage", originalDescriptor);
    }
  });

  it("defaults to 'custom' pack", async () => {
    const iconPackStore = await freshStore();
    expect(iconPackStore.get()).toBe("custom");
  });

  it("set() changes the current pack and persists to localStorage", async () => {
    const iconPackStore = await freshStore();
    iconPackStore.set("lucide");
    expect(iconPackStore.get()).toBe("lucide");
    expect(store.get("p0-ide-v2:icon-pack")).toBe("lucide");
  });

  it("subscribe notifies on set() and unsubscribe stops notifications", async () => {
    const iconPackStore = await freshStore();
    const listener = vi.fn();
    const unsub = iconPackStore.subscribe(listener);

    iconPackStore.set("tabler");
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    iconPackStore.set("carbon");
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("set() is a no-op when setting the same pack", async () => {
    const iconPackStore = await freshStore();
    const listener = vi.fn();
    iconPackStore.subscribe(listener);

    iconPackStore.set("custom"); // same as default
    expect(listener).not.toHaveBeenCalled();
    expect(iconPackStore.get()).toBe("custom");
  });
});
