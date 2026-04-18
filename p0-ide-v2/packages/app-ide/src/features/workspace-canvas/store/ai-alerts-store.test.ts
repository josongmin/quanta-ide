import { describe, it, expect, beforeEach } from "vitest";
import { aiAlertsStore } from "./ai-alerts-store";
import type { Anomaly } from "../lib/ai-service";

describe("ai-alerts-store", () => {
  beforeEach(() => {
    aiAlertsStore.clear();
  });

  it("starts empty", () => {
    const s = aiAlertsStore.getState();
    expect(s.anomalies).toEqual([]);
    expect(s.byFileId.size).toBe(0);
    expect(s.pending).toBe(false);
  });

  it("indexes anomalies by fileId after setAnomalies", () => {
    const items: Anomaly[] = [
      { kind: "coupling-spike", fileId: "a", severity: "high", explanation: "x" },
      { kind: "unreachable", fileId: "a", severity: "low", explanation: "y" },
      { kind: "cycle-gone-hot", fileId: "b", severity: "med", explanation: "z" },
    ];
    aiAlertsStore.setAnomalies(items);
    const s = aiAlertsStore.getState();
    expect(s.anomalies.length).toBe(3);
    expect(s.byFileId.get("a")?.length).toBe(2);
    expect(s.byFileId.get("b")?.length).toBe(1);
    expect(s.countByKind["coupling-spike"]).toBe(1);
    expect(s.countByKind["unreachable"]).toBe(1);
    expect(s.countByKind["cycle-gone-hot"]).toBe(1);
    expect(s.countByKind["owner-drift"]).toBe(0);
    expect(s.pending).toBe(false);
    expect(s.lastRunAt).toBeGreaterThan(0);
  });

  it("clears back to empty", () => {
    aiAlertsStore.setAnomalies([
      { kind: "coupling-spike", fileId: "a", severity: "high", explanation: "x" },
    ]);
    aiAlertsStore.clear();
    expect(aiAlertsStore.getState().anomalies).toEqual([]);
  });

  it("tracks pending flag through setPending", () => {
    aiAlertsStore.setPending(true);
    expect(aiAlertsStore.getState().pending).toBe(true);
    aiAlertsStore.setPending(false);
    expect(aiAlertsStore.getState().pending).toBe(false);
  });
});
