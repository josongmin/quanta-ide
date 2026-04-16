import { describe, it, expect, vi, beforeEach } from "vitest";
import type { FeatureManifest } from "../feature-registry/types";
import type { RegistryEvent } from "../feature-registry/feature-registry";

// ---------------------------------------------------------------------------
// Fresh registry per test.
// ---------------------------------------------------------------------------

async function freshRegistry() {
  const mod = await import("../feature-registry/feature-registry");
  return mod.featureRegistry;
}

function manifest(overrides: Partial<FeatureManifest> = {}): FeatureManifest {
  return {
    id: "test-feature",
    title: "Test Feature",
    description: "A test feature",
    category: "intelligence",
    visibility: "user",
    version: "1.0.0",
    ...overrides,
  };
}

describe("featureRegistry", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("register adds a feature to the registry", async () => {
    const reg = await freshRegistry();
    reg.register(manifest({ id: "feat-1" }));
    const features = reg.get().features;
    expect(features.has("feat-1")).toBe(true);
    expect(features.get("feat-1")!.title).toBe("Test Feature");
    expect(features.get("feat-1")!.state).toBe("active");
  });

  it("unregister removes a feature from the registry", async () => {
    const reg = await freshRegistry();
    reg.register(manifest({ id: "feat-1" }));
    expect(reg.get().features.has("feat-1")).toBe(true);
    reg.unregister("feat-1");
    expect(reg.get().features.has("feat-1")).toBe(false);
  });

  it("unregister on unknown id does nothing", async () => {
    const reg = await freshRegistry();
    reg.register(manifest({ id: "feat-1" }));
    reg.unregister("nonexistent");
    expect(reg.get().features.size).toBe(1);
  });

  it("getAll returns all registered features via get().features", async () => {
    const reg = await freshRegistry();
    reg.register(manifest({ id: "a", title: "Alpha" }));
    reg.register(manifest({ id: "b", title: "Beta" }));
    reg.register(manifest({ id: "c", title: "Gamma" }));
    expect(reg.get().features.size).toBe(3);
    expect([...reg.get().features.keys()]).toEqual(["a", "b", "c"]);
  });

  it("setState changes feature state to disabled", async () => {
    const reg = await freshRegistry();
    reg.register(manifest({ id: "feat-1" }));
    reg.setState("feat-1", "disabled");
    expect(reg.get().features.get("feat-1")!.state).toBe("disabled");
  });

  it("setState changes feature state to error with message", async () => {
    const reg = await freshRegistry();
    reg.register(manifest({ id: "feat-1" }));
    reg.setState("feat-1", "error", "something went wrong");
    const record = reg.get().features.get("feat-1")!;
    expect(record.state).toBe("error");
    expect(record.errorMessage).toBe("something went wrong");
  });

  it("setState on unknown feature does nothing", async () => {
    const reg = await freshRegistry();
    // Should not throw.
    reg.setState("nonexistent", "disabled");
    expect(reg.get().features.size).toBe(0);
  });

  it("pushEvent records events with correct kind (register)", async () => {
    const reg = await freshRegistry();
    reg.register(manifest({ id: "feat-1" }));
    const events = reg.get().events;
    expect(events.length).toBeGreaterThanOrEqual(1);
    const registerEvent = events.find((e: RegistryEvent) => e.kind === "register");
    expect(registerEvent).toBeDefined();
    expect(registerEvent!.kind).toBe("register");
    expect((registerEvent as RegistryEvent & { featureId: string }).featureId).toBe("feat-1");
  });

  it("subscribe notifies on register and state change", async () => {
    const reg = await freshRegistry();
    const listener = vi.fn();
    reg.subscribe(listener);

    reg.register(manifest({ id: "feat-1" }));
    expect(listener).toHaveBeenCalledTimes(1);

    reg.setState("feat-1", "disabled");
    expect(listener).toHaveBeenCalledTimes(2);
  });

  it("unsubscribe stops notifications", async () => {
    const reg = await freshRegistry();
    const listener = vi.fn();
    const unsub = reg.subscribe(listener);

    reg.register(manifest({ id: "feat-1" }));
    expect(listener).toHaveBeenCalledTimes(1);

    unsub();
    reg.register(manifest({ id: "feat-2" }));
    expect(listener).toHaveBeenCalledTimes(1);
  });

  it("discriminated union events carry correct kind field for each type", async () => {
    const reg = await freshRegistry();
    reg.register(manifest({ id: "feat-1" }));
    reg.setState("feat-1", "disabled");
    reg.setState("feat-1", "error", "oops");
    reg.setState("feat-1", "active");
    reg.unregister("feat-1");

    const events = reg.get().events;
    const kinds = events.map((e: RegistryEvent) => e.kind);
    expect(kinds).toContain("register");
    expect(kinds).toContain("disable");
    expect(kinds).toContain("error");
    expect(kinds).toContain("enable");
    expect(kinds).toContain("unregister");
  });

  it("getEvents returns event history via get().events", async () => {
    const reg = await freshRegistry();
    expect(reg.get().events).toEqual([]);
    reg.register(manifest({ id: "feat-1" }));
    expect(reg.get().events.length).toBe(1);
    reg.register(manifest({ id: "feat-2" }));
    expect(reg.get().events.length).toBe(2);
  });

  it("clearEvents empties the event log", async () => {
    const reg = await freshRegistry();
    reg.register(manifest({ id: "feat-1" }));
    reg.register(manifest({ id: "feat-2" }));
    expect(reg.get().events.length).toBe(2);
    reg.clearEvents();
    expect(reg.get().events.length).toBe(0);
  });
});
