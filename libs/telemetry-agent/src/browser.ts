// Browser-safe subset of @quanta/telemetry-agent.
//
// Re-exports only the modules that do not reach `node:fs/promises`, so
// consumers bundled with Vite / esbuild / webpack for the browser can
// import session rollup + validation without pulling a Node polyfill
// through their bundle graph.
//
// The Node-only entries (`sink-jsonl`, `reader`) live under the root
// export and should be imported from `@quanta/telemetry-agent` only in
// Node contexts.

export { TelemetryEmitter, type TelemetryListener } from "./emitter";
export {
  rollupSessions,
  type RolledSession,
  type RolledTask,
  type RolledTimelineEvent,
  type RolledEventKind,
  type RolledStatus,
} from "./rollup";
export {
  validateEvent,
  validateEvents,
  TelemetryValidationError,
  type ValidationError,
  type ValidateEventResult,
} from "./validate";
export type {
  TelemetryEvent,
  TelemetryEventKind,
  AgentRuntime,
} from "./events";
