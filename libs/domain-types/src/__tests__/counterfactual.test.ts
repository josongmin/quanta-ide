import { describe, it, expect, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// Fresh store/projector per test.
// ---------------------------------------------------------------------------

async function freshStore() {
  const mod = await import("../counterfactual/model/counterfactual-store");
  return mod.counterfactualStore;
}

async function freshProjector() {
  const mod = await import("../counterfactual/model/projector");
  return mod.project;
}

describe("counterfactual", () => {
  beforeEach(() => {
    vi.resetModules();
  });

  it("counterfactualStore.get returns default state with a projection", async () => {
    const store = await freshStore();
    const s = store.get();
    expect(s.input).toBeDefined();
    expect(s.projection).toBeDefined();
    expect(s.projection.trajectoriesByMetric).toBeDefined();
    expect(s.projection.predictedIncidents.length).toBeGreaterThan(0);
  });

  it("counterfactualStore.setHorizon updates horizon and recomputes", async () => {
    const store = await freshStore();
    store.setHorizon(30);
    const s = store.get();
    expect(s.input.horizonDays).toBe(30);
    // Trajectories should exist for the new horizon.
    const riskApply = s.projection.trajectoriesByMetric.risk.apply;
    expect(riskApply.points.length).toBeGreaterThan(0);
  });

  it("counterfactualStore.setMetric updates the selected metric", async () => {
    const store = await freshStore();
    store.setMetric("blast");
    expect(store.get().input.metric).toBe("blast");
  });

  it("projector produces projection with all five metrics", async () => {
    const project = await freshProjector();
    const projection = project({
      changeSetId: "cs-test",
      targetSymbol: "test.fn",
      currentRisk: 50,
      currentBlast: 10,
      currentCpx: 5,
      currentCoverage: 60,
      horizonDays: 14,
      metric: "risk",
    });

    const metrics = Object.keys(projection.trajectoriesByMetric);
    expect(metrics).toContain("risk");
    expect(metrics).toContain("blast");
    expect(metrics).toContain("cpx");
    expect(metrics).toContain("coverage");
    expect(metrics).toContain("incident");

    // Each metric should have both apply and dismiss trajectories.
    for (const m of metrics) {
      const pair = projection.trajectoriesByMetric[m as keyof typeof projection.trajectoriesByMetric];
      expect(pair.apply.points.length).toBeGreaterThan(0);
      expect(pair.dismiss.points.length).toBeGreaterThan(0);
      // Day 0 should pin to the base.
      expect(pair.apply.points[0].day).toBe(0);
      expect(pair.dismiss.points[0].day).toBe(0);
    }

    expect(projection.predictedIncidents.length).toBeGreaterThan(0);
    expect(projection.predictedCascade.length).toBeGreaterThan(0);
    expect(projection.costs.apply.scenario).toBe("apply");
    expect(projection.costs.dismiss.scenario).toBe("dismiss");
  });
});
