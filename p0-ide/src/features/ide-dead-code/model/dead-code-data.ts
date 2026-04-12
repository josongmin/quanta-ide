export interface DeadSymbol {
  id: string;
  name: string;
  kind: "function" | "class" | "type" | "const" | "method";
  file: string;
  line: number;
  lastCalled: string | null;
  confidence: "high" | "medium";
  reason: string;
}

export const DEAD_SYMBOLS: DeadSymbol[] = [
  { id: "d1", name: "_legacy_inference_bridge", kind: "function", file: "orchestrator.py", line: 887, lastCalled: null, confidence: "high", reason: "Zero references in call graph" },
  { id: "d2", name: "OldRetryPolicy", kind: "class", file: "retry.ts", line: 214, lastCalled: "2024-11-03", confidence: "high", reason: "Replaced by RetryScheduler in PR #312" },
  { id: "d3", name: "formatLegacyResponse", kind: "function", file: "webhook.ts", line: 102, lastCalled: "2025-01-15", confidence: "medium", reason: "Only called from deprecated endpoint" },
  { id: "d4", name: "TEMP_FEATURE_FLAG", kind: "const", file: "config.ts", line: 45, lastCalled: null, confidence: "high", reason: "Flag permanently enabled, condition always true" },
  { id: "d5", name: "DebugPaymentFlow", kind: "class", file: "debug.ts", line: 1, lastCalled: null, confidence: "high", reason: "Debug-only, no production import path" },
  { id: "d6", name: "migrateV1Schema", kind: "function", file: "schema.ts", line: 340, lastCalled: "2024-08-20", confidence: "medium", reason: "Migration completed, no pending V1 data" },
];
