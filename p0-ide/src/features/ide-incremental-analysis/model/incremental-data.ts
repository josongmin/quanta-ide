export type AnalysisStatus = "cached" | "reanalyzed" | "skipped" | "queued";

export interface IncrementalFile {
  id: string;
  file: string;
  status: AnalysisStatus;
  durationMs?: number;
  reason: string;
}

export interface IncrementalRun {
  runId: string;
  timestamp: string;
  totalFiles: number;
  cached: number;
  reanalyzed: number;
  skipped: number;
  totalDurationMs: number;
  files: IncrementalFile[];
}

export const SAMPLE_RUN: IncrementalRun = {
  runId: "run-20260413-0148",
  timestamp: "2026-04-13T01:48:00Z",
  totalFiles: 31,
  cached: 22,
  reanalyzed: 7,
  skipped: 2,
  totalDurationMs: 1840,
  files: [
    { id: "i1", file: "orchestrator.py", status: "reanalyzed", durationMs: 420, reason: "File changed (3 lines)" },
    { id: "i2", file: "fee.ts", status: "reanalyzed", durationMs: 280, reason: "Dependency changed (orchestrator.py)" },
    { id: "i3", file: "webhook.ts", status: "reanalyzed", durationMs: 310, reason: "Dependency changed (orchestrator.py)" },
    { id: "i4", file: "retry.ts", status: "reanalyzed", durationMs: 190, reason: "Transitive dependency" },
    { id: "i5", file: "ledger.ts", status: "reanalyzed", durationMs: 240, reason: "Dependency changed (orchestrator.py)" },
    { id: "i6", file: "billing.ts", status: "reanalyzed", durationMs: 220, reason: "Transitive dependency" },
    { id: "i7", file: "audit.ts", status: "reanalyzed", durationMs: 180, reason: "Dependency changed (orchestrator.py)" },
    { id: "i8", file: "config.ts", status: "skipped", reason: "No code changes, config only" },
    { id: "i9", file: "schema.ts", status: "skipped", reason: "Type-only file, no runtime impact" },
    { id: "i10", file: "log.ts", status: "cached", reason: "No changes since last run" },
    { id: "i11", file: "metrics.ts", status: "cached", reason: "No changes since last run" },
    { id: "i12", file: "cache.ts", status: "cached", reason: "No changes since last run" },
  ],
};
