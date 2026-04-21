import { describe, it, expect } from "vitest";
import { validateEvent, validateEvents } from "./validate";
import type { TelemetryEvent } from "./events";

describe("validateEvent — valid variants", () => {
  it("accepts task-start", () => {
    const e: TelemetryEvent = {
      kind: "task-start",
      t: 1,
      sessionId: "s1",
      taskId: "t1",
      label: "Do a thing",
      agentRuntime: "claude-code",
    };
    const res = validateEvent(e);
    expect(res.ok).toBe(true);
    if (res.ok) expect(res.event).toBe(e);
  });

  it("accepts task-done", () => {
    const e: TelemetryEvent = {
      kind: "task-done",
      t: 2,
      sessionId: "s1",
      taskId: "t1",
      outcome: "success",
      durationMs: 500,
    };
    expect(validateEvent(e).ok).toBe(true);
  });

  it("accepts tool-call", () => {
    const e: TelemetryEvent = {
      kind: "tool-call",
      t: 3,
      sessionId: "s1",
      taskId: "t1",
      tool: "read",
      success: true,
      durationMs: 10,
    };
    expect(validateEvent(e).ok).toBe(true);
  });

  it("accepts retry", () => {
    const e: TelemetryEvent = {
      kind: "retry",
      t: 4,
      sessionId: "s1",
      taskId: "t1",
      attempt: 2,
      reason: "timeout",
    };
    expect(validateEvent(e).ok).toBe(true);
  });

  it("accepts plan-deviation", () => {
    const e: TelemetryEvent = {
      kind: "plan-deviation",
      t: 5,
      sessionId: "s1",
      taskId: "t1",
      note: "picked different file",
    };
    expect(validateEvent(e).ok).toBe(true);
  });

  it("accepts human-override (with and without taskId)", () => {
    expect(
      validateEvent({
        kind: "human-override",
        t: 6,
        sessionId: "s1",
        note: "stop",
      }).ok,
    ).toBe(true);
    expect(
      validateEvent({
        kind: "human-override",
        t: 6,
        sessionId: "s1",
        taskId: "t1",
        note: "stop",
      }).ok,
    ).toBe(true);
  });

  it("accepts metric with partial fields", () => {
    expect(
      validateEvent({
        kind: "metric",
        t: 7,
        sessionId: "s1",
        tokensIn: 100,
      }).ok,
    ).toBe(true);
    expect(
      validateEvent({
        kind: "metric",
        t: 7,
        sessionId: "s1",
      }).ok,
    ).toBe(true);
  });
});

describe("validateEvent — failures", () => {
  it("reports missing discriminator", () => {
    const res = validateEvent({ t: 1, sessionId: "s1" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0]?.path).toBe(".kind");
      expect(res.errors[0]?.reason).toBe("missing");
    }
  });

  it("reports unknown discriminator", () => {
    const res = validateEvent({ kind: "nope", t: 1, sessionId: "s1" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors[0]?.path).toBe(".kind");
      expect(res.errors[0]?.reason).toMatch(/unknown kind/);
    }
  });

  it("reports expected-object for non-objects", () => {
    expect(validateEvent(null).ok).toBe(false);
    expect(validateEvent(42).ok).toBe(false);
    expect(validateEvent([]).ok).toBe(false);
  });

  it("reports missing required field for the variant", () => {
    // task-start missing label + agentRuntime
    const res = validateEvent({
      kind: "task-start",
      t: 1,
      sessionId: "s1",
      taskId: "t1",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const paths = res.errors.map((e) => e.path);
      expect(paths).toContain(".label");
      expect(paths).toContain(".agentRuntime");
    }
  });

  it("reports wrong type", () => {
    const res = validateEvent({
      kind: "tool-call",
      t: "not a number",
      sessionId: "s1",
      taskId: "t1",
      tool: "read",
      success: "yes",
      durationMs: 10,
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const paths = res.errors.map((e) => e.path);
      expect(paths).toContain(".t");
      expect(paths).toContain(".success");
    }
  });

  it("collects multiple errors rather than short-circuiting", () => {
    const res = validateEvent({ kind: "task-done", t: 1, sessionId: "s1" });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      const paths = res.errors.map((e) => e.path);
      expect(paths).toContain(".taskId");
      expect(paths).toContain(".outcome");
      expect(paths).toContain(".durationMs");
    }
  });

  it("rejects unknown agentRuntime", () => {
    const res = validateEvent({
      kind: "task-start",
      t: 1,
      sessionId: "s1",
      taskId: "t1",
      label: "x",
      agentRuntime: "robogpt",
    });
    expect(res.ok).toBe(false);
    if (!res.ok) {
      expect(res.errors.some((e) => e.path === ".agentRuntime")).toBe(true);
    }
  });
});

describe("validateEvents", () => {
  it("returns array error for non-arrays", () => {
    const res = validateEvents({ not: "array" });
    expect(res.valid).toEqual([]);
    expect(res.errors[0]?.reason).toBe("expected array");
  });

  it("keeps valid entries and reports indexed errors for bad ones", () => {
    const good: TelemetryEvent = {
      kind: "metric",
      t: 1,
      sessionId: "s1",
    };
    const res = validateEvents([good, { kind: "metric" }, good]);
    expect(res.valid).toHaveLength(2);
    const paths = res.errors.map((e) => e.path);
    // The bad entry was at index 1 and is missing `t` + `sessionId`
    expect(paths).toContain("[1].t");
    expect(paths).toContain("[1].sessionId");
  });
});
