// Node-only JSONL reader. Tolerant: blank lines and `#` comments are
// skipped; malformed or invalid lines are collected into `errors`
// instead of throwing, so a single bad line does not nuke a session.

import { readFile } from "node:fs/promises";
import type { TelemetryEvent } from "./events";
import { validateEvent } from "./validate";

/** Per-line parse/validation failure carried in `ReadResult.errors`. */
export interface ReadError {
  /** 1-based line number in the source file. */
  line: number;
  /** The offending line, as read from disk (trailing newline trimmed). */
  text: string;
  /** Human-readable explanation. */
  reason: string;
}

/** Outcome of `readEventsFromJsonl`. */
export interface ReadResult {
  events: TelemetryEvent[];
  errors: ReadError[];
}

/**
 * Read and parse a JSONL telemetry file. Never throws on content —
 * only on fs errors (missing file, permission denied, etc.).
 *
 * Lines that are empty (after trimming) or start with `#` are ignored.
 * Every other line must be a JSON object that passes `validateEvent`.
 */
export async function readEventsFromJsonl(path: string): Promise<ReadResult> {
  const raw = await readFile(path, "utf8");
  const lines = raw.split(/\r?\n/);
  const events: TelemetryEvent[] = [];
  const errors: ReadError[] = [];

  for (let i = 0; i < lines.length; i++) {
    const text = lines[i] ?? "";
    const trimmed = text.trim();
    if (trimmed === "" || trimmed.startsWith("#")) continue;

    let parsed: unknown;
    try {
      parsed = JSON.parse(trimmed);
    } catch (err) {
      errors.push({
        line: i + 1,
        text,
        reason: err instanceof Error ? err.message : "invalid JSON",
      });
      continue;
    }
    const res = validateEvent(parsed);
    if (res.ok) {
      events.push(res.event);
    } else {
      errors.push({
        line: i + 1,
        text,
        reason: res.errors.map((e) => `${e.path} ${e.reason}`).join("; "),
      });
    }
  }

  return { events, errors };
}
