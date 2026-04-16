import type { ToolCall } from "../model/types";

export const RESPONSES = [
  "I analyzed `orchestrator.py` — the **retry loop** at line 73 re-invokes `execute()` without checking the idempotency key. This is the root cause of the double-ledger write.\n\n```python\n# orchestrator.py:73\nasync def execute(task):\n    guard = IdempotencyGuard(task.key)\n    if guard.already_processed:\n        return guard.cached\n    result = await self._strategy.run(task)\n    guard.mark_done(result)\n    return result\n```\n\nRisk score would drop from **78** to ~**35** with this fix.",
  "Looking at the taint flow from `request.body` → `store_value()`:\n\n- **Source:** `webhook.py:12` — raw user input\n- **Propagation:** passes through `retry_handler.py` unvalidated\n- **Sink:** `orchestrator.py:89` — `_store.set()` call\n\nThe path has **no sanitization**. I recommend adding input validation at the handler boundary.",
  "Found **3 dead code blocks** with high confidence:\n\n- `_legacy_inference_bnd()` at line 147 — unreferenced since commit `a3f21c`\n- `OldRetryPolicy` class at line 153 — replaced by `RetryStrategy`\n- `TEMP_FEATURE_FLAG` at line 159 — feature shipped 4 months ago\n\nSafe to remove all three. Want me to generate the cleanup patch?",
  "I scanned the blast radius for `execute()` — **38 callers** across 6 modules.\n\nHighest-impact dependents:\n- `payment_handler.py` — 22 call sites\n- `fee.py` — 18 call sites\n- `webhook.py` — 15 call sites\n\nAny change to `execute()` signature should be coordinated with the payments team.",
  "Coverage analysis shows **0%** on `orchestrator.py` — 8 functions are completely uncovered.\n\nPriority test targets (by caller count):\n1. `execute()` — 38 callers, risk 0.92\n2. `_select_strategy()` — 12 callers\n3. `_store.openTransaction()` — 9 callers\n\nShall I scaffold the test file?",
];

const TOOL_CALL_POOLS: ToolCall[][] = [
  [
    { name: "Read", file: "orchestrator.py", status: "done" },
    { name: "Grep", file: "src/", status: "done" },
    { name: "Read", file: "retry_handler.py", status: "done" },
  ],
  [
    { name: "Read", file: "webhook.py", status: "done" },
    { name: "Grep", file: "execute()", status: "done" },
  ],
  [
    { name: "Grep", file: "TEMP_FEATURE_FLAG", status: "done" },
    { name: "Read", file: "orchestrator.py", status: "done" },
  ],
];

export function mockToolCalls(): ToolCall[] {
  return TOOL_CALL_POOLS[Math.floor(Math.random() * TOOL_CALL_POOLS.length)];
}
