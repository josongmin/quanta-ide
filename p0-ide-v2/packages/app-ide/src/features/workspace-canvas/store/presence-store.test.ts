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

  it("setAgents replaces the agent list and notifies the legacy subscription", () => {
    const list: readonly AgentPresence[] = [makeAgent("a1"), makeAgent("a2")];
    const listener = vi.fn();
    const unsubscribe = presenceStore.subscribe(listener);
    presenceStore.setAgents(list);
    expect(presenceStore.getState().agents).toHaveLength(2);
    expect(presenceStore.getState().agents[0].agentId).toBe("a1");
    // setAgents bumps both slices, so the legacy listener fires twice
    // (once per slice emit). This matches `usePresenceStore`'s old
    // contract — the hook re-reads on each notify and React bails on
    // value-equal selector returns, so the double-notify is harmless.
    expect(listener).toHaveBeenCalled();
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
    const beforeAgents = presenceStore.getState().agents;
    const listener = vi.fn();
    const unsubscribe = presenceStore.subscribe(listener);
    presenceStore.updateAgent("missing", { activity: "reading" });
    expect(presenceStore.getState().agents).toBe(beforeAgents);
    expect(listener).not.toHaveBeenCalled();
    unsubscribe();
  });

  it("removeAgent short-circuits when the agent is not present", () => {
    presenceStore.setAgents([makeAgent("a1")]);
    const listener = vi.fn();
    const unsubscribe = presenceStore.subscribe(listener);
    presenceStore.removeAgent("missing");
    expect(listener).not.toHaveBeenCalled();
    presenceStore.removeAgent("a1");
    expect(presenceStore.getState().agents).toHaveLength(0);
    expect(listener).toHaveBeenCalled();
    unsubscribe();
  });

  describe("slice subscriptions", () => {
    it("updateAgentCursor wakes cursor-only listeners, not activity-only listeners", () => {
      presenceStore.setAgents([makeAgent("a1", { focusFileId: "f1" })]);
      const cursorL = vi.fn();
      const activityL = vi.fn();
      const unsubC = presenceStore.subscribeCursors(cursorL);
      const unsubA = presenceStore.subscribeActivity(activityL);

      presenceStore.updateAgentCursor("a1", { focusFileId: "f2" });

      expect(cursorL).toHaveBeenCalledTimes(1);
      expect(activityL).not.toHaveBeenCalled();
      expect(presenceStore.getCursors().get("a1")?.focusFileId).toBe("f2");
      // Activity slice identity is unchanged when only the cursor slice mutates.
      expect(presenceStore.getActivity().get("a1")?.activity).toBe("idle");
      unsubC();
      unsubA();
    });

    it("updateAgentActivity wakes activity-only listeners, not cursor-only listeners", () => {
      presenceStore.setAgents([makeAgent("a1", { activity: "idle" })]);
      const cursorL = vi.fn();
      const activityL = vi.fn();
      const unsubC = presenceStore.subscribeCursors(cursorL);
      const unsubA = presenceStore.subscribeActivity(activityL);

      presenceStore.updateAgentActivity("a1", { activity: "editing", updatedAt: 100 });

      expect(cursorL).not.toHaveBeenCalled();
      expect(activityL).toHaveBeenCalledTimes(1);
      expect(presenceStore.getActivity().get("a1")?.activity).toBe("editing");
      unsubC();
      unsubA();
    });

    it("updateAgentCursor is a no-op when the value is unchanged", () => {
      presenceStore.setAgents([makeAgent("a1", { focusFileId: "f1" })]);
      const cursorL = vi.fn();
      const unsubC = presenceStore.subscribeCursors(cursorL);
      presenceStore.updateAgentCursor("a1", { focusFileId: "f1" });
      expect(cursorL).not.toHaveBeenCalled();
      unsubC();
    });

    it("updateAgent splits the patch across slices and emits only on what moved", () => {
      presenceStore.setAgents([makeAgent("a1", { focusFileId: "f1" })]);
      const cursorL = vi.fn();
      const activityL = vi.fn();
      const unsubC = presenceStore.subscribeCursors(cursorL);
      const unsubA = presenceStore.subscribeActivity(activityL);

      // Activity-only patch: cursor listener stays asleep.
      presenceStore.updateAgent("a1", { activity: "reading", updatedAt: 50 });
      expect(cursorL).not.toHaveBeenCalled();
      expect(activityL).toHaveBeenCalledTimes(1);

      cursorL.mockReset();
      activityL.mockReset();

      // Cursor-only patch: activity listener stays asleep.
      presenceStore.updateAgent("a1", { focusFileId: "f2" });
      expect(cursorL).toHaveBeenCalledTimes(1);
      expect(activityL).not.toHaveBeenCalled();

      cursorL.mockReset();
      activityL.mockReset();

      // Combined patch: both wake.
      presenceStore.updateAgent("a1", { focusFileId: "f3", activity: "editing", updatedAt: 99 });
      expect(cursorL).toHaveBeenCalledTimes(1);
      expect(activityL).toHaveBeenCalledTimes(1);

      unsubC();
      unsubA();
    });

    it("cursor map identity is stable across activity-only mutations", () => {
      presenceStore.setAgents([makeAgent("a1")]);
      const beforeCursors = presenceStore.getCursors();
      presenceStore.updateAgentActivity("a1", { activity: "editing", updatedAt: 42 });
      expect(presenceStore.getCursors()).toBe(beforeCursors);
    });

    it("activity map identity is stable across cursor-only mutations", () => {
      presenceStore.setAgents([makeAgent("a1")]);
      const beforeActivity = presenceStore.getActivity();
      presenceStore.updateAgentCursor("a1", { focusFileId: "f5" });
      expect(presenceStore.getActivity()).toBe(beforeActivity);
    });

    it("merged agents array is rebuilt only when a slice actually changes", () => {
      presenceStore.setAgents([makeAgent("a1", { focusFileId: "f1" })]);
      const firstMerge = presenceStore.getState().agents;
      // Re-read without any mutation returns the cached merge.
      expect(presenceStore.getState().agents).toBe(firstMerge);
      presenceStore.updateAgentCursor("a1", { focusFileId: "f2" });
      const secondMerge = presenceStore.getState().agents;
      expect(secondMerge).not.toBe(firstMerge);
      expect(secondMerge[0].focusFileId).toBe("f2");
    });

    it("removeAgent bumps both slice versions", () => {
      presenceStore.setAgents([makeAgent("a1"), makeAgent("a2")]);
      const cursorL = vi.fn();
      const activityL = vi.fn();
      const unsubC = presenceStore.subscribeCursors(cursorL);
      const unsubA = presenceStore.subscribeActivity(activityL);
      presenceStore.removeAgent("a1");
      expect(cursorL).toHaveBeenCalledTimes(1);
      expect(activityL).toHaveBeenCalledTimes(1);
      expect(presenceStore.getCursors().has("a1")).toBe(false);
      expect(presenceStore.getActivity().has("a1")).toBe(false);
      unsubC();
      unsubA();
    });
  });
});
