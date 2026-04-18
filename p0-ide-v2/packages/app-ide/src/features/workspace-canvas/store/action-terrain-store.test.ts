import { describe, it, expect, beforeEach } from "vitest";
import { actionTerrainStore } from "./action-terrain-store";

describe("action-terrain-store", () => {
  beforeEach(() => {
    actionTerrainStore.reset();
  });

  it("toggleMode flips the master mode flag", () => {
    expect(actionTerrainStore.getState().mode).toBe(false);
    actionTerrainStore.toggleMode();
    expect(actionTerrainStore.getState().mode).toBe(true);
    actionTerrainStore.toggleMode();
    expect(actionTerrainStore.getState().mode).toBe(false);
  });

  it("selectPlan enables showSimulationDelta; clearing disables it", () => {
    actionTerrainStore.selectPlan("plan-xyz");
    expect(actionTerrainStore.getState().activePlanId).toBe("plan-xyz");
    expect(actionTerrainStore.getState().showSimulationDelta).toBe(true);
    actionTerrainStore.selectPlan(null);
    expect(actionTerrainStore.getState().activePlanId).toBe(null);
    expect(actionTerrainStore.getState().showSimulationDelta).toBe(false);
  });

  it("setHeightScale clamps to [0.2, 2]", () => {
    actionTerrainStore.setHeightScale(5);
    expect(actionTerrainStore.getState().heightScale).toBe(2);
    actionTerrainStore.setHeightScale(0);
    expect(actionTerrainStore.getState().heightScale).toBe(0.2);
    actionTerrainStore.setHeightScale(1.25);
    expect(actionTerrainStore.getState().heightScale).toBe(1.25);
  });

  it("setConeDirection updates direction", () => {
    expect(actionTerrainStore.getState().coneDirection).toBe("blast");
    actionTerrainStore.setConeDirection("fix");
    expect(actionTerrainStore.getState().coneDirection).toBe("fix");
  });

  it("selectFile stores a root id and clears on null", () => {
    actionTerrainStore.selectFile("src/a.ts");
    expect(actionTerrainStore.getState().selectedFileId).toBe("src/a.ts");
    actionTerrainStore.selectFile(null);
    expect(actionTerrainStore.getState().selectedFileId).toBe(null);
  });
});
