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

const DEAD_BY_FILE: Record<string, DeadSymbol[]> = {
  "orchestrator.py": [
    { id: "d1", name: "_legacy_inference_bridge", kind: "function", file: "orchestrator.py", line: 887, lastCalled: null, confidence: "high", reason: "Zero references in call graph" },
    { id: "d2", name: "OldRetryPolicy", kind: "class", file: "orchestrator.py", line: 214, lastCalled: "2024-11-03", confidence: "high", reason: "Replaced by RetryScheduler in PR #312" },
    { id: "d3", name: "TEMP_FEATURE_FLAG", kind: "const", file: "orchestrator.py", line: 45, lastCalled: null, confidence: "high", reason: "Flag permanently enabled, condition always true" },
  ],
  "routing_policy.py": [
    { id: "d4", name: "formatLegacyResponse", kind: "function", file: "routing_policy.py", line: 102, lastCalled: "2025-01-15", confidence: "medium", reason: "Only called from deprecated endpoint" },
    { id: "d5", name: "_old_route_v1", kind: "function", file: "routing_policy.py", line: 340, lastCalled: "2024-08-20", confidence: "high", reason: "V1 routing removed in PR #298" },
  ],
  "security.py": [
    { id: "d6", name: "DebugTaintFlow", kind: "class", file: "security.py", line: 1, lastCalled: null, confidence: "high", reason: "Debug-only, no production import path" },
  ],
  "audit_store.py": [],
};

export function getDeadSymbols(fileName: string): DeadSymbol[] {
  return DEAD_BY_FILE[fileName] ?? [];
}
