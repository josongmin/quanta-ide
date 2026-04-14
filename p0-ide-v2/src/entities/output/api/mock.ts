import type { OutputSource, OutputSourceMeta } from "../model/types";

export const OUTPUT_SOURCES: OutputSourceMeta[] = [
  { id: "build", label: "Build" },
  { id: "tests", label: "Tests" },
  { id: "agent", label: "Agent" },
];

export const OUTPUT_LOGS: Record<OutputSource, string> = {
  build: `[12:00:00] Building payments-api...
[12:00:02] ✓ Parse 47 files
[12:00:03] ✓ Resolve imports
[12:00:04] ✓ Generate call graph (2,317 edges)
[12:00:05] Build complete — 47 files, 6,812 LOC
[12:00:10] Running tests...
[12:00:12] 12 passed, 2 failed`,
  tests: `[12:00:10] pytest tests/ -q
[12:00:11] tests/payments/test_retry.py .......F
[12:00:12] tests/payments/test_ledger.py .........
[12:00:12] 12 passed, 2 failed in 1.84s`,
  agent: `[12:01:00] agent: analyze_impact(retry_handler.py)
[12:01:02] agent: fetched 23 callers
[12:01:04] agent: propose IdempotencyGuard insertion
[12:01:05] agent: dry-run patch ready`,
};
