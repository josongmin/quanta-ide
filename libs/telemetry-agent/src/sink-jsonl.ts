// Node-only. Imports `node:fs/promises`; not safe to bundle for the browser.

import { appendFile, rename, writeFile } from "node:fs/promises";
import type { TelemetryEvent } from "./events";
import { TelemetryValidationError, validateEvent } from "./validate";

/** Options for `writeEventsToJsonl`. */
export interface JsonlSinkOptions {
  /**
   * When true, write to a temporary file first and rename into place so
   * readers never observe a half-written file. The temp suffix is
   * `.tmp-<timestamp>`; collisions are extremely unlikely in practice.
   */
  atomic?: boolean;
}

function serialise(event: TelemetryEvent): string {
  return `${JSON.stringify(event)}\n`;
}

/**
 * Validate `event` and append one JSONL line to `path`. Creates the
 * file if it does not exist. Throws `TelemetryValidationError` on a
 * schema mismatch; fs errors bubble up untouched.
 */
export async function appendEventToJsonl(path: string, event: TelemetryEvent): Promise<void> {
  const res = validateEvent(event);
  if (!res.ok) throw new TelemetryValidationError(res.errors);
  await appendFile(path, serialise(res.event), "utf8");
}

/**
 * Validate every event and write the lot to `path` as JSONL. Replaces
 * the file contents. When `opts.atomic` is true, writes via a `.tmp-*`
 * sibling and renames on success so partial writes are never visible.
 */
export async function writeEventsToJsonl(
  path: string,
  events: readonly TelemetryEvent[],
  opts: JsonlSinkOptions = {},
): Promise<void> {
  // Validate first so we never leave behind a partial file.
  for (let i = 0; i < events.length; i++) {
    const res = validateEvent(events[i], `[${i}]`);
    if (!res.ok) throw new TelemetryValidationError(res.errors);
  }
  const body = events.map(serialise).join("");
  if (opts.atomic) {
    const tmp = `${path}.tmp-${Date.now()}`;
    await writeFile(tmp, body, "utf8");
    await rename(tmp, path);
    return;
  }
  await writeFile(path, body, "utf8");
}
