import { describe, it, expect, beforeEach } from "vitest";
import type { TabAppDescriptor, AppKind } from "@quanta/shell-contract";

// ---------------------------------------------------------------------------
// The appRegistry uses a module-level Map, so we need to isolate it
// between tests.  We do this by re-importing per test via vi.resetModules().
// ---------------------------------------------------------------------------

function makeDescriptor(
  id: AppKind,
  label: string = id,
): TabAppDescriptor {
  return {
    id,
    label,
    Component: () => null,
  };
}

// Since the registry is a module-level singleton, we isolate each test by
// dynamically importing from a fresh module instance.
async function freshRegistry() {
  const { appRegistry } = await import("../app-registry");
  return appRegistry;
}

describe("appRegistry", () => {
  // Use vi.resetModules() to get a fresh singleton per test.
  beforeEach(() => {
    vi.resetModules();
  });

  it("register + get returns the descriptor", async () => {
    const reg = await freshRegistry();
    const desc = makeDescriptor("ide", "IDE");
    reg.register(desc);
    expect(reg.get("ide")).toBe(desc);
  });

  it("get for unregistered id returns undefined", async () => {
    const reg = await freshRegistry();
    expect(reg.get("agent")).toBeUndefined();
  });

  it("getAll returns all registered descriptors", async () => {
    const reg = await freshRegistry();
    const d1 = makeDescriptor("ide", "IDE");
    const d2 = makeDescriptor("agent", "Agent");
    reg.register(d1);
    reg.register(d2);
    const all = reg.getAll();
    expect(all).toHaveLength(2);
    expect(all).toContain(d1);
    expect(all).toContain(d2);
  });

  it("register overwrites an existing descriptor with the same id", async () => {
    const reg = await freshRegistry();
    const v1 = makeDescriptor("ide", "IDE v1");
    const v2 = makeDescriptor("ide", "IDE v2");
    reg.register(v1);
    reg.register(v2);
    expect(reg.get("ide")).toBe(v2);
    expect(reg.getAll()).toHaveLength(1);
  });

  it("descriptor shape matches TabAppDescriptor contract", async () => {
    const reg = await freshRegistry();
    const icon = () => "icon";
    const Component = () => null;
    const desc: TabAppDescriptor = { id: "pr", label: "PRs", icon, Component };
    reg.register(desc);
    const retrieved = reg.get("pr")!;
    expect(retrieved.id).toBe("pr");
    expect(retrieved.label).toBe("PRs");
    expect(retrieved.icon).toBe(icon);
    expect(retrieved.Component).toBe(Component);
  });
});
