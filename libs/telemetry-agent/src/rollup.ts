import type { AgentRuntime, TelemetryEvent } from "./events";

// Types below intentionally duplicate the shape of the IDE's
// `AgentSession` / `AgentTask` / `AgentTimelineEvent` / `AgentStatus`
// from products/code-universe/src/features/agent-timeline/model/types.ts.
// Duplication (rather than import) keeps this lib independent of
// `products/*`; structural typing lets the IDE assign `RolledSession`
// straight into an `AgentSession` slot.

/** Matches `AgentEventKind` from the IDE. */
export type RolledEventKind =
  | "task-start"
  | "task-done"
  | "tool-call"
  | "tool-failure"
  | "retry"
  | "plan-deviation"
  | "human-override";

/** Matches `AgentStatus` from the IDE. */
export type RolledStatus = "idle" | "working" | "blocked" | "done" | "errored";

/** Matches `AgentTimelineEvent` from the IDE. */
export interface RolledTimelineEvent {
  t: number;
  kind: RolledEventKind;
  note: string;
}

/** Matches `AgentTask` from the IDE. */
export interface RolledTask {
  id: string;
  label: string;
  startedAt: number;
  endedAt: number;
  outcome: "success" | "errored" | "in-progress";
  retries: number;
  toolCalls: number;
}

/** Matches `AgentSession` from the IDE. */
export interface RolledSession {
  id: string;
  runtime: AgentRuntime;
  label: string;
  status: RolledStatus;
  startedAt: number;
  lastActiveAt: number;
  tasks: RolledTask[];
  events: RolledTimelineEvent[];
  metrics: {
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    taskSuccessRate: number;
  };
}

// ── helpers ────────────────────────────────────────────────────────

function shortId(id: string): string {
  // Take first 6 hex-ish chars (or the whole id if shorter). Non-hex
  // chars are preserved to keep the label recognisable.
  return id.slice(0, 6);
}

function noteForEvent(e: TelemetryEvent): string {
  switch (e.kind) {
    case "task-start":
      return e.label;
    case "task-done":
      return e.outcome === "success" ? "done" : "errored";
    case "tool-call":
      return e.success ? `tool ${e.tool}` : `tool ${e.tool} failed`;
    case "retry":
      return `retry #${e.attempt}: ${e.reason}`;
    case "plan-deviation":
      return e.note;
    case "human-override":
      return e.note;
    case "metric":
      return "metric";
  }
}

function timelineKindFor(e: TelemetryEvent): RolledEventKind | null {
  switch (e.kind) {
    case "task-start":
      return "task-start";
    case "task-done":
      return "task-done";
    case "tool-call":
      return e.success ? "tool-call" : "tool-failure";
    case "retry":
      return "retry";
    case "plan-deviation":
      return "plan-deviation";
    case "human-override":
      return "human-override";
    case "metric":
      return null; // metrics feed the strip, not the timeline overlay
  }
}

/**
 * Collapse a flat event stream into per-session rollups.
 *
 * Pure and deterministic:
 *   - input may arrive unsorted; events are sorted by `t` before
 *     bucketing
 *   - session output order is the order of first-seen `sessionId`
 *     in the sorted stream
 *   - task output order is the order of first-seen `taskId` per session
 *
 * Task pairing: a `task-start` / `task-done` pair on the same `taskId`
 * yields a completed `RolledTask`. A dangling `task-start` becomes
 * `outcome: "in-progress"` with `endedAt` set to the latest event time
 * observed for that task.
 */
export function rollupSessions(input: readonly TelemetryEvent[]): RolledSession[] {
  if (input.length === 0) return [];

  // Sort chronologically. Stable sort (Array.prototype.sort in V8/etc.
  // is stable from ES2019) preserves emission order for equal `t`.
  const events = [...input].sort((a, b) => a.t - b.t);

  interface TaskAcc {
    id: string;
    label: string;
    startedAt: number | null;
    endedAt: number;
    outcome: "success" | "errored" | "in-progress";
    retries: number;
    toolCalls: number;
    order: number;
  }

  interface SessionAcc {
    id: string;
    runtime: AgentRuntime | null;
    startedAt: number;
    lastActiveAt: number;
    tasks: Map<string, TaskAcc>;
    taskOrder: number;
    events: RolledTimelineEvent[];
    tokensIn: number;
    tokensOut: number;
    costUsd: number;
    order: number;
  }

  const sessions = new Map<string, SessionAcc>();
  let sessionOrder = 0;

  const getSession = (id: string, t: number): SessionAcc => {
    const existing = sessions.get(id);
    if (existing) {
      existing.lastActiveAt = Math.max(existing.lastActiveAt, t);
      return existing;
    }
    const fresh: SessionAcc = {
      id,
      runtime: null,
      startedAt: t,
      lastActiveAt: t,
      tasks: new Map(),
      taskOrder: 0,
      events: [],
      tokensIn: 0,
      tokensOut: 0,
      costUsd: 0,
      order: sessionOrder++,
    };
    sessions.set(id, fresh);
    return fresh;
  };

  const getTask = (sess: SessionAcc, taskId: string, t: number, label?: string): TaskAcc => {
    const existing = sess.tasks.get(taskId);
    if (existing) {
      if (label !== undefined && existing.label === taskId) existing.label = label;
      existing.endedAt = Math.max(existing.endedAt, t);
      return existing;
    }
    const fresh: TaskAcc = {
      id: taskId,
      label: label ?? taskId,
      startedAt: null,
      endedAt: t,
      outcome: "in-progress",
      retries: 0,
      toolCalls: 0,
      order: sess.taskOrder++,
    };
    sess.tasks.set(taskId, fresh);
    return fresh;
  };

  for (const e of events) {
    const sess = getSession(e.sessionId, e.t);

    const kind = timelineKindFor(e);
    if (kind !== null) {
      sess.events.push({ t: e.t, kind, note: noteForEvent(e) });
    }

    switch (e.kind) {
      case "task-start": {
        const task = getTask(sess, e.taskId, e.t, e.label);
        task.startedAt = task.startedAt ?? e.t;
        task.label = e.label;
        if (sess.runtime === null) sess.runtime = e.agentRuntime;
        break;
      }
      case "task-done": {
        const task = getTask(sess, e.taskId, e.t);
        task.endedAt = Math.max(task.endedAt, e.t);
        task.outcome = e.outcome;
        break;
      }
      case "tool-call": {
        const task = getTask(sess, e.taskId, e.t);
        task.toolCalls += 1;
        break;
      }
      case "retry": {
        const task = getTask(sess, e.taskId, e.t);
        task.retries += 1;
        break;
      }
      case "plan-deviation": {
        getTask(sess, e.taskId, e.t);
        break;
      }
      case "human-override": {
        if (e.taskId !== undefined) getTask(sess, e.taskId, e.t);
        break;
      }
      case "metric": {
        if (e.tokensIn !== undefined) sess.tokensIn += e.tokensIn;
        if (e.tokensOut !== undefined) sess.tokensOut += e.tokensOut;
        if (e.costUsd !== undefined) sess.costUsd += e.costUsd;
        break;
      }
    }
  }

  const ordered = [...sessions.values()].sort((a, b) => a.order - b.order);

  return ordered.map((sess) => {
    const tasks: RolledTask[] = [...sess.tasks.values()]
      .sort((a, b) => a.order - b.order)
      .map((t) => ({
        id: t.id,
        label: t.label,
        startedAt: t.startedAt ?? t.endedAt,
        endedAt: t.endedAt,
        outcome: t.outcome,
        retries: t.retries,
        toolCalls: t.toolCalls,
      }));

    const completed = tasks.filter((t) => t.outcome !== "in-progress");
    const successCount = completed.filter((t) => t.outcome === "success").length;
    const anyErrored = tasks.some((t) => t.outcome === "errored");
    const anyInProgress = tasks.some((t) => t.outcome === "in-progress");

    let status: RolledStatus;
    if (tasks.length === 0) status = "idle";
    else if (anyErrored) status = "errored";
    else if (anyInProgress) status = "working";
    else status = "done";

    const runtime = sess.runtime ?? "unknown";
    const label = `${runtime}-${shortId(sess.id)}`;

    const taskSuccessRate = completed.length === 0 ? 0 : successCount / completed.length;

    return {
      id: sess.id,
      runtime,
      label,
      status,
      startedAt: sess.startedAt,
      lastActiveAt: sess.lastActiveAt,
      tasks,
      events: sess.events,
      metrics: {
        tokensIn: sess.tokensIn,
        tokensOut: sess.tokensOut,
        costUsd: sess.costUsd,
        taskSuccessRate,
      },
    };
  });
}
