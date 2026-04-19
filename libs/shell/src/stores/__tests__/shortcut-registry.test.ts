import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Fresh registry per test.
// ---------------------------------------------------------------------------

async function freshRegistry() {
  const mod = await import("../shortcut-registry/registry");
  return { shortcutRegistry: mod.shortcutRegistry, parseCombo: mod.parseCombo };
}

/** Helper: build a minimal KeyboardEvent-like object for dispatch. */
function kbd(
  key: string,
  opts: { meta?: boolean; ctrl?: boolean; shift?: boolean; alt?: boolean } = {},
): KeyboardEvent {
  return new KeyboardEvent("keydown", {
    key,
    metaKey: opts.meta ?? false,
    ctrlKey: opts.ctrl ?? false,
    shiftKey: opts.shift ?? false,
    altKey: opts.alt ?? false,
    bubbles: true,
  });
}

describe("shortcutRegistry", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("register + dispatch invokes the matching binding", async () => {
    const { shortcutRegistry } = await freshRegistry();
    const run = vi.fn();
    shortcutRegistry.register({ id: "test", keys: "mod+p", label: "Test", run });

    const handled = shortcutRegistry.dispatch(kbd("p", { meta: true }));
    expect(handled).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it("higher priority wins on the same key combo", async () => {
    const { shortcutRegistry } = await freshRegistry();
    const lowRun = vi.fn();
    const highRun = vi.fn();

    shortcutRegistry.register({ id: "low", keys: "mod+k", label: "Low", run: lowRun, priority: 0 });
    shortcutRegistry.register({ id: "high", keys: "mod+k", label: "High", run: highRun, priority: 10 });

    shortcutRegistry.dispatch(kbd("k", { meta: true }));
    expect(highRun).toHaveBeenCalledTimes(1);
    expect(lowRun).not.toHaveBeenCalled();
  });

  it("when guard prevents dispatch when it returns false", async () => {
    const { shortcutRegistry } = await freshRegistry();
    const run = vi.fn();
    shortcutRegistry.register({
      id: "guarded",
      keys: "mod+g",
      label: "Guarded",
      run,
      when: () => false,
    });

    const handled = shortcutRegistry.dispatch(kbd("g", { meta: true }));
    expect(handled).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it("disposer unregisters the binding", async () => {
    const { shortcutRegistry } = await freshRegistry();
    const run = vi.fn();
    const dispose = shortcutRegistry.register({ id: "temp", keys: "mod+t", label: "Temp", run });

    dispose();
    const handled = shortcutRegistry.dispatch(kbd("t", { meta: true }));
    expect(handled).toBe(false);
    expect(run).not.toHaveBeenCalled();
  });

  it("dispatch returns false when no binding matches", async () => {
    const { shortcutRegistry } = await freshRegistry();
    const handled = shortcutRegistry.dispatch(kbd("z", { meta: true }));
    expect(handled).toBe(false);
  });

  it("parseCombo handles mod+p correctly", async () => {
    const { parseCombo } = await freshRegistry();
    const combo = parseCombo("mod+p");
    expect(combo).toEqual({ mod: true, shift: false, alt: false, key: "p" });
  });

  it("parseCombo handles mod+shift+p correctly", async () => {
    const { parseCombo } = await freshRegistry();
    const combo = parseCombo("mod+shift+p");
    expect(combo).toEqual({ mod: true, shift: true, alt: false, key: "p" });
  });

  it("parseCombo handles display-form symbols (unicode)", async () => {
    const { parseCombo } = await freshRegistry();
    // ⌘⇧P  → mod + shift + P
    const combo = parseCombo("⌘⇧P");
    expect(combo.mod).toBe(true);
    expect(combo.shift).toBe(true);
    expect(combo.key).toBe("p");
  });

  it("ctrl maps to mod in parseCombo", async () => {
    const { parseCombo } = await freshRegistry();
    const combo = parseCombo("ctrl+s");
    expect(combo.mod).toBe(true);
    expect(combo.key).toBe("s");
  });

  it("dispatch matches ctrl-based events against mod bindings", async () => {
    const { shortcutRegistry } = await freshRegistry();
    const run = vi.fn();
    shortcutRegistry.register({ id: "save", keys: "mod+s", label: "Save", run });

    // On non-macOS, ctrlKey is set instead of metaKey.
    const handled = shortcutRegistry.dispatch(kbd("s", { ctrl: true }));
    expect(handled).toBe(true);
    expect(run).toHaveBeenCalledTimes(1);
  });
});
