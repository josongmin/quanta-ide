import { describe, it, expect, beforeEach, vi } from "vitest";
import { presenceStore, type AgentPresence } from "./presence-store";

function makeAgent(id: string, overrides: Partial<AgentPresence> = {}): AgentPresence {
  return {
    agentId: id,
    label: id,
    color: 0xffffff,
    focusFileId: null,
    activity: "idle",
    updatedAt: 0,
    ...overrides,
  };
}

describe("presence-store", () => {
  beforeEach(() => {
    presenceStore.setAgents([]);
  });

  it("setAgents replaces the agent list and notifies subscribers", () => {
    const list: readonly AgentPresence[] = [makeAgent("a1"), makeAgent("a2")];
    const listener = vi.fn();
    const unsubscribe = presenceStore.subscribe(listener);
    presenceStore.setAgents(list);
    expect(presenceStore.getState().agents).toBe(list);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });

  it("setAgents short-circuits on same reference", () => {
    const list: readonly AgentPresence[] = [makeAgent("a1")];
    presenceStore.setAgents(list);
    const listener = vi.fn();
    const unsubscribe = presenceStore.subscribe(listener);
    presenceStore.setAgents(list);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("updateAgent is a no-op when the id is not present", () => {
    presenceStore.setAgents([makeAgent("a1")]);
    const before = presenceStore.getState().agents;
    const listener = vi.fn();
    const unsubscribe = presenceStore.subscribe(listener);
    presenceStore.updateAgent("missing", { activity: "reading" });
    expect(presenceStore.getState().agents).toBe(before);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("removeAgent short-circuits when the agent is not present", () => {
    presenceStore.setAgents([makeAgent("a1")]);
    const listener = vi.fn();
    const unsubscribe = presenceStore.subscribe(listener);
    presenceStore.removeAgent("missing");
    expect(listener).not.toHaveBeenCalled();
    // Removing an existing agent DOES emit.
    presenceStore.removeAgent("a1");
    expect(presenceStore.getState().agents).toHaveLength(0);
    expect(listener).toHaveBeenCalledTimes(1);
    unsubscribe();
  });
});
