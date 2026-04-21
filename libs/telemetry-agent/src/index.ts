// Public surface for @quanta/telemetry-agent.
//
// Node-only modules (sink-jsonl, reader) re-export from here; consumers
// that run exclusively in the browser should import `./emitter`,
// `./events`, `./rollup`, and `./validate` individually to keep
// `node:fs/promises` out of their bundle graph.

export { TelemetryEmitter, type TelemetryListener } from "./emitter";
export {
  appendEventToJsonl,
  writeEventsToJsonl,
  type JsonlSinkOptions,
} from "./sink-jsonl";
export {
  readEventsFromJsonl,
  type ReadResult,
  type ReadError,
} from "./reader";
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
