import { describe, it, expect } from "vitest";
import { rollupSessions } from "./rollup";
import type { TelemetryEvent } from "./events";

function ts(n: number): number {
  return 1_700_000_000_000 + n;
}

describe("rollupSessions", () => {
  it("returns [] on empty input", () => {
    expect(rollupSessions([])).toEqual([]);
  });

  it("rolls up one session with one success task + one errored task", () => {
    const events: TelemetryEvent[] = [
      { kind: "task-start", t: ts(0), sessionId: "s1", taskId: "a", label: "Task A", agentRuntime: "claude-code" },
      { kind: "tool-call", t: ts(1), sessionId: "s1", taskId: "a", tool: "read", success: true, durationMs: 5 },
      { kind: "tool-call", t: ts(2), sessionId: "s1", taskId: "a", tool: "edit", success: true, durationMs: 9 },
      { kind: "task-done", t: ts(3), sessionId: "s1", taskId: "a", outcome: "success", durationMs: 3 },
      { kind: "task-start", t: ts(4), sessionId: "s1", taskId: "b", label: "Task B", agentRuntime: "claude-code" },
      { kind: "retry", t: ts(5), sessionId: "s1", taskId: "b", attempt: 1, reason: "timeout" },
      { kind: "task-done", t: ts(6), sessionId: "s1", taskId: "b", outcome: "errored", durationMs: 2 },
    ];
    const [sess] = rollupSessions(events);
    expect(sess?.id).toBe("s1");
    expect(sess?.runtime).toBe("claude-code");
    expect(sess?.status).toBe("errored"); // any errored → errored
    expect(sess?.tasks).toHaveLength(2);
    expect(sess?.tasks[0]?.toolCalls).toBe(2);
    expect(sess?.tasks[0]?.outcome).toBe("success");
    expect(sess?.tasks[1]?.retries).toBe(1);
    expect(sess?.tasks[1]?.outcome).toBe("errored");
    expect(sess?.metrics.taskSuccessRate).toBeCloseTo(0.5);
    expect(sess?.startedAt).toBe(ts(0));
    expect(sess?.lastActiveAt).toBe(ts(6));
  });

  it("marks dangling task-start as in-progress with endedAt = last event", () => {
    const events: TelemetryEvent[] = [
      { kind: "task-start", t: ts(0), sessionId: "s1", taskId: "a", label: "A", agentRuntime: "cursor" },
      { kind: "tool-call", t: ts(5), sessionId: "s1", taskId: "a", tool: "read", success: true, durationMs: 1 },
    ];
    const [sess] = rollupSessions(events);
    expect(sess?.status).toBe("working");
    expect(sess?.tasks[0]?.outcome).toBe("in-progress");
    expect(sess?.tasks[0]?.startedAt).toBe(ts(0));
    expect(sess?.tasks[0]?.endedAt).toBe(ts(5));
  });

  it("buckets multiple sessions independently", () => {
    const events: TelemetryEvent[] = [
      { kind: "task-start", t: ts(10), sessionId: "s2", taskId: "a", label: "A", agentRuntime: "devin" },
      { kind: "task-start", t: ts(0), sessionId: "s1", taskId: "a", label: "A", agentRuntime: "human" },
      { kind: "task-done", t: ts(1), sessionId: "s1", taskId: "a", outcome: "success", durationMs: 1 },
      { kind: "task-done", t: ts(20), sessionId: "s2", taskId: "a", outcome: "success", durationMs: 1 },
    ];
    const rolled = rollupSessions(events);
    // Session order follows first-seen in sorted stream → s1 first.
    expect(rolled.map((s) => s.id)).toEqual(["s1", "s2"]);
    expect(rolled[0]?.runtime).toBe("human");
    expect(rolled[1]?.runtime).toBe("devin");
    expect(rolled[0]?.status).toBe("done");
    expect(rolled[1]?.status).toBe("done");
  });

  it("aggregates metrics across metric events", () => {
    const events: TelemetryEvent[] = [
      { kind: "metric", t: ts(0), sessionId: "s1", tokensIn: 10, tokensOut: 20, costUsd: 0.01 },
      { kind: "metric", t: ts(1), sessionId: "s1", tokensIn: 5, costUsd: 0.02 },
      { kind: "metric", t: ts(2), sessionId: "s1", tokensOut: 7 },
    ];
    const [sess] = rollupSessions(events);
    expect(sess?.metrics.tokensIn).toBe(15);
    expect(sess?.metrics.tokensOut).toBe(27);
    expect(sess?.metrics.costUsd).toBeCloseTo(0.03);
    // No tasks → idle, success rate 0.
    expect(sess?.status).toBe("idle");
    expect(sess?.metrics.taskSuccessRate).toBe(0);
  });

  it("produces stable chronological events even for unsorted input", () => {
    const events: TelemetryEvent[] = [
      { kind: "task-done", t: ts(3), sessionId: "s1", taskId: "a", outcome: "success", durationMs: 1 },
      { kind: "tool-call", t: ts(2), sessionId: "s1", taskId: "a", tool: "edit", success: true, durationMs: 1 },
      { kind: "task-start", t: ts(1), sessionId: "s1", taskId: "a", label: "A", agentRuntime: "codex" },
    ];
    const [sess] = rollupSessions(events);
    const times = sess?.events.map((e) => e.t);
    expect(times).toEqual([ts(1), ts(2), ts(3)]);
    expect(sess?.events.map((e) => e.kind)).toEqual(["task-start", "tool-call", "task-done"]);
  });

  it("falls back to runtime=unknown when no task-start seen", () => {
    const events: TelemetryEvent[] = [
      { kind: "human-override", t: ts(0), sessionId: "s1", note: "hi" },
    ];
    const [sess] = rollupSessions(events);
    expect(sess?.runtime).toBe("unknown");
    expect(sess?.label.startsWith("unknown-")).toBe(true);
  });

  it("labels sessions as runtime-<first6 of id>", () => {
    const events: TelemetryEvent[] = [
      { kind: "task-start", t: ts(0), sessionId: "abcdef123456", taskId: "a", label: "A", agentRuntime: "devin" },
      { kind: "task-done", t: ts(1), sessionId: "abcdef123456", taskId: "a", outcome: "success", durationMs: 1 },
    ];
    const [sess] = rollupSessions(events);
    expect(sess?.label).toBe("devin-abcdef");
  });

  it("counts tool-failure as 'tool-failure' in timeline events", () => {
    const events: TelemetryEvent[] = [
      { kind: "task-start", t: ts(0), sessionId: "s1", taskId: "a", label: "A", agentRuntime: "claude-code" },
      { kind: "tool-call", t: ts(1), sessionId: "s1", taskId: "a", tool: "write", success: false, durationMs: 3 },
    ];
    const [sess] = rollupSessions(events);
    const kinds = sess?.events.map((e) => e.kind);
    expect(kinds).toContain("tool-failure");
  });

  it("omits metric events from the timeline overlay", () => {
    const events: TelemetryEvent[] = [
      { kind: "metric", t: ts(0), sessionId: "s1", tokensIn: 1 },
    ];
    const [sess] = rollupSessions(events);
    expect(sess?.events).toEqual([]);
  });
});
