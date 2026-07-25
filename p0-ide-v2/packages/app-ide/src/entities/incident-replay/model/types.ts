export type EventKind =
  | "enter"
  | "exit"
  | "log"
  | "write"
  | "read"
  | "await"
  | "resume"
  | "branch"
  | "exception";

export interface ReplayEvent {
  id: string;
  /** milliseconds from incident start */
  t: number;
  kind: EventKind;
  line: number;
  /** e.g. "orchestrator.dispatch" */
  frame: string;
  /** call-stack depth at this point (pre-event) */
  depth: number;
  /** human-readable summary: "log: cache miss for key=u-42" */
  text: string;
  /** optional expanded payload (log message, value) */
  detail?: string;
  /** for branch events */
  variant?: "took" | "skipped";
  /** the path NOT taken, human-readable */
  counterfactual?: string;
  level?: "info" | "warn" | "error";
}

export interface VariableSnapshot {
  /** closest event time */
  t: number;
  frame: string;
  vars: Array<{ name: string; value: string; changed?: boolean }>;
}

export interface IncidentDnaSample {
  /** sampled every ~N ms */
  t: number;
  /** 0-100 */
  cpu: number;
  /** 0-100 */
  mem: number;
  /** 0-100 */
  io: number;
}

export interface IncidentReplay {
  incidentId: string;
  title: string;
  /** ISO date */
  capturedAt: string;
  rootCauseFrame?: string;
  durationMs: number;
  events: ReplayEvent[];
  snapshots: VariableSnapshot[];
  dna: IncidentDnaSample[];
  /** line of the exception */
  failingLine?: number;
}
