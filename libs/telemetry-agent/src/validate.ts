import type { AgentRuntime, TelemetryEvent, TelemetryEventKind } from "./events";

/**
 * Validation failure descriptor. `path` is a JSON-pointer-ish string
 * rooted at the event (e.g. `".tool"` for a scalar field, `"[3].tool"`
 * when emitted from `validateEvents`).
 */
export interface ValidationError {
  path: string;
  reason: string;
}

/** Result of `validateEvent`. */
export type ValidateEventResult =
  | { ok: true; event: TelemetryEvent }
  | { ok: false; errors: ValidationError[] };

const KINDS: ReadonlySet<TelemetryEventKind> = new Set<TelemetryEventKind>([
  "task-start",
  "task-done",
  "tool-call",
  "retry",
  "plan-deviation",
  "human-override",
  "metric",
]);

const RUNTIMES: ReadonlySet<AgentRuntime> = new Set<AgentRuntime>([
  "claude-code",
  "cursor",
  "devin",
  "codex",
  "github-copilot",
  "human",
  "unknown",
]);

const OUTCOMES: ReadonlySet<"success" | "errored"> = new Set(["success", "errored"]);

function isObject(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function checkString(o: Record<string, unknown>, key: string, errs: ValidationError[], prefix: string): void {
  const v = o[key];
  if (v === undefined) errs.push({ path: `${prefix}.${key}`, reason: "missing" });
  else if (typeof v !== "string") errs.push({ path: `${prefix}.${key}`, reason: "expected string" });
}

function checkNumber(o: Record<string, unknown>, key: string, errs: ValidationError[], prefix: string): void {
  const v = o[key];
  if (v === undefined) errs.push({ path: `${prefix}.${key}`, reason: "missing" });
  else if (typeof v !== "number" || !Number.isFinite(v)) errs.push({ path: `${prefix}.${key}`, reason: "expected finite number" });
}

function checkBoolean(o: Record<string, unknown>, key: string, errs: ValidationError[], prefix: string): void {
  const v = o[key];
  if (v === undefined) errs.push({ path: `${prefix}.${key}`, reason: "missing" });
  else if (typeof v !== "boolean") errs.push({ path: `${prefix}.${key}`, reason: "expected boolean" });
}

function checkOptionalNumber(o: Record<string, unknown>, key: string, errs: ValidationError[], prefix: string): void {
  const v = o[key];
  if (v === undefined) return;
  if (typeof v !== "number" || !Number.isFinite(v)) errs.push({ path: `${prefix}.${key}`, reason: "expected finite number" });
}

function checkOptionalString(o: Record<string, unknown>, key: string, errs: ValidationError[], prefix: string): void {
  const v = o[key];
  if (v === undefined) return;
  if (typeof v !== "string") errs.push({ path: `${prefix}.${key}`, reason: "expected string" });
}

function checkEnum<T extends string>(
  o: Record<string, unknown>,
  key: string,
  allowed: ReadonlySet<T>,
  errs: ValidationError[],
  prefix: string,
): void {
  const v = o[key];
  if (v === undefined) {
    errs.push({ path: `${prefix}.${key}`, reason: "missing" });
    return;
  }
  if (typeof v !== "string" || !allowed.has(v as T)) {
    errs.push({ path: `${prefix}.${key}`, reason: `expected one of ${[...allowed].join("|")}` });
  }
}

/**
 * Validate a single candidate event. Returns `{ ok: true, event }` with
 * the input narrowed to `TelemetryEvent`, or `{ ok: false, errors }`
 * with every problem found (not just the first).
 */
export function validateEvent(e: unknown, basePath = ""): ValidateEventResult {
  const errs: ValidationError[] = [];
  if (!isObject(e)) {
    return { ok: false, errors: [{ path: basePath || "", reason: "expected object" }] };
  }
  const kind = e["kind"];
  if (typeof kind !== "string") {
    errs.push({ path: `${basePath}.kind`, reason: "missing" });
    return { ok: false, errors: errs };
  }
  if (!KINDS.has(kind as TelemetryEventKind)) {
    errs.push({ path: `${basePath}.kind`, reason: `unknown kind ${JSON.stringify(kind)}` });
    return { ok: false, errors: errs };
  }

  // Common required fields.
  checkNumber(e, "t", errs, basePath);
  checkString(e, "sessionId", errs, basePath);

  switch (kind as TelemetryEventKind) {
    case "task-start":
      checkString(e, "taskId", errs, basePath);
      checkString(e, "label", errs, basePath);
      checkEnum(e, "agentRuntime", RUNTIMES, errs, basePath);
      break;
    case "task-done":
      checkString(e, "taskId", errs, basePath);
      checkEnum(e, "outcome", OUTCOMES, errs, basePath);
      checkNumber(e, "durationMs", errs, basePath);
      break;
    case "tool-call":
      checkString(e, "taskId", errs, basePath);
      checkString(e, "tool", errs, basePath);
      checkBoolean(e, "success", errs, basePath);
      checkNumber(e, "durationMs", errs, basePath);
      break;
    case "retry":
      checkString(e, "taskId", errs, basePath);
      checkNumber(e, "attempt", errs, basePath);
      checkString(e, "reason", errs, basePath);
      break;
    case "plan-deviation":
      checkString(e, "taskId", errs, basePath);
      checkString(e, "note", errs, basePath);
      break;
    case "human-override":
      checkOptionalString(e, "taskId", errs, basePath);
      checkString(e, "note", errs, basePath);
      break;
    case "metric":
      checkOptionalNumber(e, "tokensIn", errs, basePath);
      checkOptionalNumber(e, "tokensOut", errs, basePath);
      checkOptionalNumber(e, "costUsd", errs, basePath);
      break;
  }

  if (errs.length > 0) return { ok: false, errors: errs };
  return { ok: true, event: e as TelemetryEvent };
}

/**
 * Validate an array of candidate events. Returns the valid subset and
 * every error encountered; indices in error paths match the input
 * position (`[i].field`).
 */
export function validateEvents(es: unknown): { valid: TelemetryEvent[]; errors: ValidationError[] } {
  if (!Array.isArray(es)) {
    return { valid: [], errors: [{ path: "", reason: "expected array" }] };
  }
  const valid: TelemetryEvent[] = [];
  const errors: ValidationError[] = [];
  for (let i = 0; i < es.length; i++) {
    const res = validateEvent(es[i], `[${i}]`);
    if (res.ok) valid.push(res.event);
    else errors.push(...res.errors);
  }
  return { valid, errors };
}

/** Thrown by the JSONL sink when the candidate event fails validation. */
export class TelemetryValidationError extends Error {
  readonly errors: ValidationError[];
  constructor(errors: ValidationError[]) {
    super(`telemetry event failed validation: ${errors.map((e) => `${e.path} ${e.reason}`).join("; ")}`);
    this.name = "TelemetryValidationError";
    this.errors = errors;
  }
}
