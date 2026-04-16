import { describe, it, expect } from "vitest";

// ---------------------------------------------------------------------------
// Verify that the barrel export re-exports key symbols from sub-modules.
// ---------------------------------------------------------------------------

describe("domain-types barrel exports", () => {
  it("re-exports agent-rules symbols", async () => {
    const mod = await import("../index");
    expect(mod.parseRules).toBeTypeOf("function");
    expect(mod.stringifyDocument).toBeTypeOf("function");
    expect(mod.buildDocument).toBeTypeOf("function");
    expect(mod.getAdapter).toBeTypeOf("function");
    expect(mod.BUILTIN_ADAPTERS).toBeDefined();
    expect(Array.isArray(mod.BUILTIN_ADAPTERS)).toBe(true);
    expect(mod.rulesStore).toBeDefined();
    expect(typeof mod.rulesStore.get).toBe("function");
  });

  it("re-exports counterfactual symbols", async () => {
    const mod = await import("../index");
    expect(mod.METRIC_LABEL).toBeDefined();
    expect(mod.METRIC_UNIT).toBeDefined();
    expect(mod.METRIC_INVERTED).toBeDefined();
    expect(mod.counterfactualStore).toBeDefined();
    expect(mod.project).toBeTypeOf("function");
  });

  it("counterfactual METRIC_LABEL contains expected metric keys", async () => {
    const mod = await import("../index");
    const labels = mod.METRIC_LABEL;
    // Should be a record with string values
    expect(typeof labels).toBe("object");
    const keys = Object.keys(labels);
    expect(keys.length).toBeGreaterThan(0);
    for (const v of Object.values(labels)) {
      expect(typeof v).toBe("string");
    }
  });
});
