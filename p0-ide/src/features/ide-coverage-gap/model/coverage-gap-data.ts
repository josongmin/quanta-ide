export interface UncoveredSymbol {
  name: string;
  kind: "function" | "method" | "class";
  line: number;
  risk: 1 | 2 | 3 | 4;
}

export interface CoverageGapFile {
  id: string;
  file: string;
  covered: number;
  total: number;
  uncovered: UncoveredSymbol[];
}

const GAPS_BY_FILE: Record<string, CoverageGapFile[]> = {
  "orchestrator.py": [
    { id: "cg1", file: "orchestrator.py", covered: 0, total: 12, uncovered: [
      { name: "execute", kind: "function", line: 315, risk: 4 },
      { name: "_decide_reasoning_path", kind: "function", line: 362, risk: 3 },
      { name: "_select_strategy", kind: "function", line: 398, risk: 3 },
      { name: "_run_beam_strategy", kind: "function", line: 441, risk: 3 },
    ]},
    { id: "cg2", file: "fee.ts", covered: 4, total: 7, uncovered: [
      { name: "calculateFee", kind: "function", line: 42, risk: 4 },
      { name: "validateFeeRule", kind: "function", line: 88, risk: 3 },
    ]},
    { id: "cg3", file: "webhook.ts", covered: 2, total: 5, uncovered: [
      { name: "dispatchWebhook", kind: "function", line: 31, risk: 4 },
      { name: "verifySignature", kind: "function", line: 78, risk: 4 },
    ]},
  ],
  "routing_policy.py": [
    { id: "cg4", file: "routing_policy.py", covered: 1, total: 9, uncovered: [
      { name: "_route_request", kind: "function", line: 88, risk: 3 },
      { name: "_select_backend", kind: "function", line: 142, risk: 2 },
    ]},
  ],
  "security.py": [
    { id: "cg5", file: "security.py", covered: 2, total: 7, uncovered: [
      { name: "_analyze_taint_path_control_flow", kind: "function", line: 477, risk: 3 },
    ]},
  ],
  "audit_store.py": [],
};

export function getCoverageGaps(fileName: string): CoverageGapFile[] {
  return GAPS_BY_FILE[fileName] ?? [];
}
