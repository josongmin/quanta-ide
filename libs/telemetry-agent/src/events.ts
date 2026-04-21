// Event schema for the agent-telemetry stream.
//
// Each event is a tagged union member discriminated by `kind`. The IDE
// consumes these events directly (via the emitter) and/or indirectly
// (via JSONL → reader → rollup) to drive the Agent Orchestrator view.

/**
 * Runtime label for the actor that produced an event. Mirrors the union
 * used by the IDE's agent-timeline feature so rolled sessions are
 * structurally assignable to `AgentSession`.
 */
export type AgentRuntime =
  | "claude-code"
  | "cursor"
  | "devin"
  | "codex"
  | "github-copilot"
  | "human"
  | "unknown";

/**
 * A single telemetry record. All times are absolute unix-ms.
 *
 * Discriminated by `kind`. Task events carry a `taskId` scoping the
 * event to a single unit of work; session-level events (metrics,
 * human-override) attach only to the session.
 */
export type TelemetryEvent =
  | {
      kind: "task-start";
      t: number;
      sessionId: string;
      taskId: string;
      label: string;
      agentRuntime: AgentRuntime;
    }
  | {
      kind: "task-done";
      t: number;
      sessionId: string;
      taskId: string;
      outcome: "success" | "errored";
      durationMs: number;
    }
  | {
      kind: "tool-call";
      t: number;
      sessionId: string;
      taskId: string;
      tool: string;
      success: boolean;
      durationMs: number;
    }
  | {
      kind: "retry";
      t: number;
      sessionId: string;
      taskId: string;
      attempt: number;
      reason: string;
    }
  | {
      kind: "plan-deviation";
      t: number;
      sessionId: string;
      taskId: string;
      note: string;
    }
  | {
      kind: "human-override";
      t: number;
      sessionId: string;
      taskId?: string;
      note: string;
    }
  | {
      kind: "metric";
      t: number;
      sessionId: string;
      tokensIn?: number;
      tokensOut?: number;
      costUsd?: number;
    };

/** Narrow alias for the discriminator field. */
export type TelemetryEventKind = TelemetryEvent["kind"];
