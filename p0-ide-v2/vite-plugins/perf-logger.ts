import type { Plugin } from "vite";
import * as fs from "node:fs";
import * as fsp from "node:fs/promises";
import * as path from "node:path";
import * as os from "node:os";

// ───────────────────────────────────────────────────────────────────
// Perf log sink for the workspace canvas.
//
// Client posts an ND-JSON dump of a sliding frame window when FPS drops
// below a threshold. We persist it OUTSIDE the repo so it survives git
// cleanups / branch swaps and is easy to inspect with `tail -f` or
// `jq`. Default dir: ~/quanta-ide-perf-logs/.
//
// File name carries the trigger and timestamp for grep-ability:
//   perf-{trigger}-{ISO}.ndjson
//
// Endpoint:
//   POST /__perf/log   body: { trigger, frames: any[], meta }
// ───────────────────────────────────────────────────────────────────

const DEFAULT_DIR = path.join(os.homedir(), "quanta-ide-perf-logs");

function sanitizeSegment(s: string): string {
  return s.replace(/[^\w.-]/g, "_").slice(0, 80);
}

export function perfLoggerPlugin(options?: { dir?: string }): Plugin {
  const dir = options?.dir ?? DEFAULT_DIR;

  return {
    name: "quanta:perf-logger",
    configureServer(server) {
      // Ensure the directory exists on server start — fail loudly if we
      // can't write there so the user discovers the issue immediately.
      try {
        fs.mkdirSync(dir, { recursive: true });
      } catch (err) {
        server.config.logger.warn(`[perf-logger] cannot create ${dir}: ${String(err)}`);
      }

      server.middlewares.use("/__perf/log", async (req, res) => {
        if (req.method !== "POST") {
          res.statusCode = 405;
          res.end("POST only");
          return;
        }

        // Read the body
        let raw = "";
        try {
          for await (const chunk of req) raw += chunk.toString("utf8");
        } catch (err) {
          res.statusCode = 400;
          res.end(`body read failed: ${String(err)}`);
          return;
        }

        let body: {
          trigger?: string;
          frames?: unknown[];
          meta?: Record<string, unknown>;
        };
        try {
          body = JSON.parse(raw);
        } catch {
          res.statusCode = 400;
          res.end("invalid JSON");
          return;
        }

        const trigger = sanitizeSegment(body.trigger ?? "unknown");
        const isoSafe = new Date().toISOString().replace(/[:.]/g, "-");
        const filename = `perf-${trigger}-${isoSafe}.ndjson`;
        const full = path.join(dir, filename);

        // Write a single header line with meta, then one line per frame.
        // The client may mix "special" records (transition, summary) into the
        // frames array, tagged with a `_kind` override — promote that to the
        // line's top-level `kind` so readers can grep them cleanly.
        const lines: string[] = [];
        lines.push(JSON.stringify({ kind: "meta", trigger, writtenAt: Date.now(), ...(body.meta ?? {}) }));
        for (const raw of body.frames ?? []) {
          const f = raw as { _kind?: string } & Record<string, unknown>;
          if (f && typeof f._kind === "string") {
            const { _kind, ...rest } = f;
            lines.push(JSON.stringify({ kind: _kind, ...rest }));
          } else {
            lines.push(JSON.stringify({ kind: "frame", ...(f as object) }));
          }
        }

        try {
          await fsp.writeFile(full, lines.join("\n") + "\n", "utf8");
        } catch (err) {
          res.statusCode = 500;
          res.end(`write failed: ${String(err)}`);
          return;
        }

        server.config.logger.info(`[perf-logger] wrote ${filename} (${lines.length} lines)`);
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ ok: true, path: full, bytes: Buffer.byteLength(lines.join("\n"), "utf8") }));
      });

      // GET /__perf/log — return the log directory path so client UI can show it.
      server.middlewares.use("/__perf/dir", (_req, res) => {
        res.setHeader("Content-Type", "application/json");
        res.end(JSON.stringify({ dir }));
      });
    },
  };
}
