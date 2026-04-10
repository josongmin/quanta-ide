// Per-file metadata for the File Inspector view

export interface FileSymbol {
  name: string;
  kind: "function" | "class" | "const" | "type";
  loc: string;
  riskScore: number;
  cpx?: string;
  callers?: number;
  tests?: string;
  taint?: "source" | "sink" | "passthrough";
  dead?: boolean;
}

/** A signal = one actionable risk finding at the file level */
export interface FileSignal {
  kind: "no-tests" | "taint-sink" | "taint-source" | "dead-code" | "bus-factor" | "high-cpx" | "blast";
  message: string;
  severity: 1 | 2 | 3; // 1=info, 2=warn, 3=critical
  /** symbol name this signal points at, if any */
  symbol?: string;
}

/** One row in the function heatmap (line-density viz) */
export interface HeatRow {
  name: string;
  loc: string;   // line number string
  risk: number;  // 0-100
  cpx: number;
  dead?: boolean;
}

/** A file that imports / is affected by this file */
export interface BlastNeighbor {
  name: string;
  risk: number;
  relation: "imports-us" | "we-import";
}

export interface FileInspectorData {
  fileName: string;
  loc: number;
  functions: number;
  lastModified: string;
  author: string;
  busFactor: number;
  riskScore: number;
  blastTotal: number;
  taintPaths: number;
  deadCode: number;
  symbols: FileSymbol[];
  owners: { name: string; coverage: number }[];
  /** Risk signals — shown as the first thing after the header */
  signals: FileSignal[];
  /** Function heatmap rows */
  heatRows: HeatRow[];
  /** Top connected files */
  blastNeighbors: BlastNeighbor[];
}

export const FILE_INSPECTOR: Record<string, FileInspectorData> = {
  "orchestrator.py": {
    fileName: "orchestrator.py",
    loc: 1974,
    functions: 11,
    lastModified: "2w ago",
    author: "@songmin",
    busFactor: 1,
    riskScore: 78,
    blastTotal: 38,
    taintPaths: 2,
    deadCode: 1,
    signals: [
      { kind: "no-tests",    severity: 3, message: "0 of 12 callers have tests", symbol: "execute" },
      { kind: "taint-sink",  severity: 3, message: "request.task reaches experience_store.save unvalidated", symbol: "execute" },
      { kind: "taint-source",severity: 2, message: "DeepReasoningRequest.strategy is a taint source", symbol: "execute" },
      { kind: "dead-code",   severity: 1, message: "_legacy_inference_bridge — removed in v8, 0 callers (5mo)", symbol: "_legacy_inference_bridge" },
      { kind: "bus-factor",  severity: 2, message: "Only @songmin has >50% ownership" },
    ],
    heatRows: [
      { name: "execute",                   loc: "315", risk: 78, cpx: 9.1 },
      { name: "_decide_reasoning_path",    loc: "362", risk: 41, cpx: 4.2 },
      { name: "_select_strategy",          loc: "398", risk: 38, cpx: 3.8 },
      { name: "_run_beam_strategy",        loc: "441", risk: 52, cpx: 5.9 },
      { name: "_legacy_inference_bridge",  loc: "887", risk: 0,  cpx: 1.1, dead: true },
    ],
    blastNeighbors: [
      { name: "routing_policy.py",  risk: 44, relation: "we-import" },
      { name: "shared/reasoning.py",risk: 61, relation: "we-import" },
      { name: "domain/models.py",   risk: 31, relation: "we-import" },
    ],
    symbols: [
      { name: "DeepReasoningOrchestrator",    kind: "class",    loc: "6",   riskScore: 78, cpx: "9.1", callers: 12, tests: "0/12" },
      { name: "execute",                      kind: "function", loc: "315", riskScore: 78, cpx: "9.1", callers: 12, tests: "0/12", taint: "sink" },
      { name: "_decide_reasoning_path",       kind: "function", loc: "362", riskScore: 41, cpx: "4.2", callers: 1,  tests: "0/1" },
      { name: "_select_strategy",             kind: "function", loc: "398", riskScore: 38, cpx: "3.8", callers: 1,  tests: "0/1" },
      { name: "_run_beam_strategy",           kind: "function", loc: "441", riskScore: 52, cpx: "5.9", callers: 1,  tests: "0/1" },
      { name: "_legacy_inference_bridge",     kind: "function", loc: "887", riskScore: 0,  cpx: "1.1", callers: 0,  dead: true },
    ],
    owners: [
      { name: "@songmin",  coverage: 81 },
      { name: "@devops-bot", coverage: 19 },
    ],
  },
  "routing_policy.py": {
    fileName: "routing_policy.py",
    loc: 621,
    functions: 7,
    lastModified: "1w ago",
    author: "@songmin",
    busFactor: 2,
    riskScore: 44,
    blastTotal: 14,
    taintPaths: 1,
    deadCode: 0,
    signals: [
      { kind: "no-tests",    severity: 2, message: "1 of 9 callers have tests", symbol: "_route_request" },
      { kind: "taint-source",severity: 2, message: "request.route_key is a taint source", symbol: "_route_request" },
      { kind: "high-cpx",    severity: 1, message: "_route_request complexity 5.1 — above threshold" },
    ],
    heatRows: [
      { name: "_route_request",       loc: "88",  risk: 44, cpx: 5.1 },
      { name: "_validate_policy",     loc: "142", risk: 28, cpx: 3.2 },
      { name: "_select_backend",      loc: "198", risk: 31, cpx: 3.6 },
      { name: "_apply_rate_limit",    loc: "247", risk: 18, cpx: 2.1 },
    ],
    blastNeighbors: [
      { name: "orchestrator.py",  risk: 78, relation: "imports-us" },
      { name: "domain/models.py", risk: 31, relation: "we-import" },
      { name: "audit_store.py",   risk: 23, relation: "we-import" },
    ],
    symbols: [
      { name: "RoutingPolicy",     kind: "class",    loc: "12",  riskScore: 44, cpx: "5.1", callers: 9,  tests: "1/9" },
      { name: "_route_request",    kind: "function", loc: "88",  riskScore: 44, cpx: "5.1", callers: 9,  tests: "1/9", taint: "source" },
      { name: "_validate_policy",  kind: "function", loc: "142", riskScore: 28, cpx: "3.2", callers: 3,  tests: "2/3" },
      { name: "_select_backend",   kind: "function", loc: "198", riskScore: 31, cpx: "3.6", callers: 2,  tests: "1/2" },
      { name: "_apply_rate_limit", kind: "function", loc: "247", riskScore: 18, cpx: "2.1", callers: 2,  tests: "2/2" },
    ],
    owners: [
      { name: "@songmin",    coverage: 74 },
      { name: "@devops-bot", coverage: 26 },
    ],
  },
  "security.py": {
    fileName: "security.py",
    loc: 477,
    functions: 8,
    lastModified: "3w ago",
    author: "@devops-bot",
    busFactor: 2,
    riskScore: 52,
    blastTotal: 21,
    taintPaths: 1,
    deadCode: 1,
    signals: [
      { kind: "taint-sink",  severity: 2, message: "target param reaches semgrep CLI without path normalization", symbol: "_analyze_taint_path_control_flow" },
      { kind: "no-tests",    severity: 2, message: "2 of 7 callers covered — 5 untested", symbol: "_analyze_taint_path_control_flow" },
      { kind: "dead-code",   severity: 1, message: "_joern_cpg_bridge — removed in RFC-041, 0 callers (6mo)", symbol: "_joern_cpg_bridge" },
    ],
    heatRows: [
      { name: "_analyze_taint_path_control_flow", loc: "477", risk: 52, cpx: 6.3 },
      { name: "_build_cfg",                       loc: "312", risk: 28, cpx: 3.1 },
      { name: "_run_semgrep_analysis",            loc: "388", risk: 45, cpx: 4.2 },
      { name: "_identify_security_guards",        loc: "421", risk: 22, cpx: 2.8 },
      { name: "_joern_cpg_bridge",                loc: "198", risk: 0,  cpx: 1.4, dead: true },
    ],
    blastNeighbors: [
      { name: "base.py",          risk: 31, relation: "we-import" },
      { name: "orchestrator.py",  risk: 78, relation: "imports-us" },
      { name: "domain/models.py", risk: 31, relation: "we-import" },
    ],
    symbols: [
      { name: "AnalyzeControlFlowTool",              kind: "class",    loc: "84",  riskScore: 52, cpx: "6.3", callers: 7,  tests: "2/7" },
      { name: "_analyze_taint_path_control_flow",    kind: "function", loc: "477", riskScore: 52, cpx: "6.3", callers: 7,  tests: "2/7", taint: "sink" },
      { name: "_build_cfg",                          kind: "function", loc: "312", riskScore: 28, cpx: "3.1", callers: 2,  tests: "1/2" },
      { name: "_run_semgrep_analysis",               kind: "function", loc: "388", riskScore: 45, cpx: "4.2", callers: 1,  tests: "0/1" },
      { name: "_identify_security_guards",           kind: "function", loc: "421", riskScore: 22, cpx: "2.8", callers: 1,  tests: "1/1" },
      { name: "_joern_cpg_bridge",                   kind: "function", loc: "198", riskScore: 0,  cpx: "1.4", callers: 0,  dead: true },
    ],
    owners: [
      { name: "@devops-bot", coverage: 62 },
      { name: "@songmin",    coverage: 38 },
    ],
  },
  "audit_store.py": {
    fileName: "audit_store.py",
    loc: 312,
    functions: 5,
    lastModified: "1mo ago",
    author: "@songmin",
    busFactor: 2,
    riskScore: 23,
    blastTotal: 8,
    taintPaths: 0,
    deadCode: 0,
    signals: [
      { kind: "blast", severity: 1, message: "Imported by 8 files — schema changes have wide reach" },
    ],
    heatRows: [
      { name: "store_request",  loc: "214", risk: 23, cpx: 2.4 },
      { name: "get",            loc: "259", risk: 12, cpx: 1.8 },
      { name: "_init_schema",   loc: "169", risk: 8,  cpx: 1.3 },
      { name: "_get_connection",loc: "155", risk: 5,  cpx: 1.1 },
    ],
    blastNeighbors: [
      { name: "orchestrator.py",  risk: 78, relation: "imports-us" },
      { name: "security.py",      risk: 52, relation: "imports-us" },
      { name: "replay/router.py", risk: 18, relation: "imports-us" },
    ],
    symbols: [
      { name: "RequestAuditLog", kind: "class",    loc: "35",  riskScore: 23, cpx: "2.4", callers: 5, tests: "5/5" },
      { name: "AuditStore",      kind: "class",    loc: "111", riskScore: 23, cpx: "2.4", callers: 5, tests: "5/5" },
      { name: "store_request",   kind: "function", loc: "214", riskScore: 23, cpx: "2.4", callers: 5, tests: "5/5" },
      { name: "get",             kind: "function", loc: "259", riskScore: 12, cpx: "1.8", callers: 3, tests: "3/3" },
      { name: "_init_schema",    kind: "function", loc: "169", riskScore: 8,  cpx: "1.3", callers: 1, tests: "1/1" },
    ],
    owners: [
      { name: "@songmin",    coverage: 88 },
      { name: "@devops-bot", coverage: 12 },
    ],
  },
};
