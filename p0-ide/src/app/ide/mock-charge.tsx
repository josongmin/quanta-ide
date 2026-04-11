import { HoverSymbol, type CodeLine, type LineHint  } from "@/widgets/ide-editor";
import type { CallNode } from "@/features/ide-call-graph";
import type { FlowStep } from "@/features/ide-data-flow";

export const CHARGE_LINES: CodeLine[] = [
  {
    no: 1,
    code: (
      <>
        <span className="kw">from</span>{" "}
        <HoverSymbol info={{ name: "dataclasses", kind: "import", origin: "stdlib", detail: "Standard library dataclasses — @dataclass, @field. No external deps." }}>
          <span className="str">dataclasses</span>
        </HoverSymbol>
        {" "}<span className="kw">import</span> <span className="var">dataclass</span>
      </>
    ),
  },
  {
    no: 2,
    code: (
      <>
        <span className="kw">from</span>{" "}
        <HoverSymbol info={{ name: "codegraph_shared.common.observability", kind: "import", origin: "shared/observability.py", callers: 48, detail: "Structured logging. get_logger returns structlog.BoundLogger. Used in 48 modules." }}>
          <span className="str">codegraph_shared.common.observability</span>
        </HoverSymbol>
        {" "}<span className="kw">import</span> <span className="var">get_logger</span>
      </>
    ),
  },
  {
    no: 3,
    code: (
      <>
        <span className="kw">from</span>{" "}
        <HoverSymbol info={{ name: ".base", kind: "import", origin: "tools/plan_orchestration/tools/base.py", callers: 9, detail: "StepTool ABC + StepToolResult dataclass. All plan tools extend StepTool." }}>
          <span className="str">.base</span>
        </HoverSymbol>
        {" "}<span className="kw">import</span> <span className="var">QueryDSLMixin</span><span className="punct">,</span> <span className="var"> StepTool</span><span className="punct">,</span> <span className="var"> StepToolResult</span>
      </>
    ),
  },
  { no: 4, code: null },
  {
    no: 5,
    code: (
      <span className="com">{"# ================================================================"}</span>
    ),
  },
  {
    no: 6,
    code: (
      <span className="com">{"# Security Tools (RFC-041)"}</span>
    ),
  },
  { no: 7, code: null },
  {
    no: 8,
    risk: 3,
    context: { lineNo: 8, risk: 3, summary: "Class — AnalyzeControlFlowTool, CPX 6.3", detail: "RFC-041 StepTool for taint path & control flow analysis. Wraps Semgrep/CodeQL patterns. 7 callers." },
    code: (
      <>
        <span className="kw">class </span>
        <HoverSymbol info={{ name: "AnalyzeControlFlowTool", kind: "function", complexity: 6.3, callers: 7, blame: { author: "@devops-bot", when: "3w ago" }, detail: "Semgrep-based control-flow analyzer. Finds taint paths, security guards, and CFG reachability. 2/7 callers tested.", tags: ["hot-path"] }}>
          <span className="fn">AnalyzeControlFlowTool</span>
        </HoverSymbol>
        <span className="punct">(</span><span className="var">StepTool</span><span className="punct">):</span>
      </>
    ),
    hints: [
      { type: "complexity", value: 6.3 } as LineHint,
      { type: "coverage", passed: 2, total: 7 } as LineHint,
    ],
  },
  {
    no: 9,
    code: (
      <>
        {"    "}<span className="com">{"# RFC-041: SOTA — Semgrep + Infer hybrid"}</span>
      </>
    ),
  },
  {
    no: 10,
    risk: 4,
    context: { lineNo: 10, risk: 4, summary: "_analyze_taint_path_control_flow — main entrypoint", detail: "Dispatches to semgrep runner, builds CFG, identifies security guards. Tainted target param flows to _run_semgrep_analysis." },
    code: (
      <>
        {"    "}<span className="kw">def </span>
        <HoverSymbol info={{ name: "_analyze_taint_path_control_flow", kind: "function", riskScore: 52, complexity: 6.3, callers: 7, blame: { author: "@devops-bot", when: "3w ago" }, detail: "Primary taint analysis dispatcher. target param is unvalidated user input — flows directly into semgrep subprocess call.", tags: ["no-tests", "hot-path"] }}>
          <span className="fn">_analyze_taint_path_control_flow</span>
        </HoverSymbol>
        <span className="punct">(</span><span className="kw">self</span><span className="punct">,</span>{" "}
        <HoverSymbol info={{ name: "target", kind: "variable", taint: "source", origin: "StepToolRequest", flowsTo: "_run_semgrep_analysis (L18)", detail: "Unvalidated path string. Passed to semgrep CLI — path traversal possible if not sanitized." }}>
          <span className="var">target</span>
        </HoverSymbol>
        <span className="punct">: </span><span className="var">str</span><span className="punct">) -&gt; </span><span className="var">StepToolResult</span><span className="punct">:</span>
      </>
    ),
    hints: [
      { type: "callers", count: 7, warn: true } as LineHint,
      { type: "taint-flow", from: "target", to: "_run_semgrep" } as LineHint,
    ],
  },
  {
    no: 11,
    risk: 3,
    code: (
      <>
        {"        "}<span className="var">cfg</span>{" "}<span className="punct">=</span>{" "}
        <span className="kw">self</span><span className="punct">.</span>
        <HoverSymbol info={{ name: "_build_cfg", kind: "function", complexity: 3.1, callers: 2, detail: "Builds CFG from AST. Uses astroid. Returns dict of BasicBlock nodes. Raises on syntax error." }}>
          <span className="fn">_build_cfg</span>
        </HoverSymbol>
        <span className="punct">(</span><span className="var">target</span><span className="punct">)</span>
      </>
    ),
  },
  {
    no: 12,
    risk: 4,
    context: { lineNo: 12, risk: 4, summary: "Taint sink — semgrep run with user-controlled target", detail: "target flows from request into semgrep subprocess. No path normalization before this call." },
    code: (
      <>
        {"        "}<span className="var">findings</span>{" "}<span className="punct">=</span>{" "}
        <span className="kw">self</span><span className="punct">.</span>
        <HoverSymbol info={{ name: "_run_semgrep_analysis", kind: "function", taint: "sink", complexity: 4.2, callers: 1, detail: "Runs semgrep CLI via subprocess. target path is not normalized — path traversal possible. No allowlist check.", tags: ["write", "no-tests"] }}>
          <span className="fn">_run_semgrep_analysis</span>
        </HoverSymbol>
        <span className="punct">(</span><span className="var">target</span><span className="punct">,</span>{" "}<span className="var">cfg</span><span className="punct">)</span>
      </>
    ),
    hints: [
      { type: "warn-badge", label: "path traversal" } as LineHint,
    ],
  },
  {
    no: 13,
    risk: 2,
    code: (
      <>
        {"        "}<span className="var">guards</span>{" "}<span className="punct">=</span>{" "}
        <span className="kw">self</span><span className="punct">.</span>
        <HoverSymbol info={{ name: "_identify_security_guards", kind: "function", complexity: 2.8, callers: 1, detail: "Identifies sanitizers/validators in the CFG that protect sinks from tainted sources." }}>
          <span className="fn">_identify_security_guards</span>
        </HoverSymbol>
        <span className="punct">(</span><span className="var">cfg</span><span className="punct">,</span>{" "}<span className="var">findings</span><span className="punct">)</span>
      </>
    ),
  },
  {
    no: 14,
    risk: 2,
    code: (
      <>
        {"        "}<span className="kw">return </span>
        <HoverSymbol info={{ name: "StepToolResult", kind: "variable", detail: "Result dataclass. confidence=0.85 if guards found, 0.65 otherwise." }}>
          <span className="var">StepToolResult</span>
        </HoverSymbol>
        <span className="punct">(</span><span className="var">success</span><span className="punct">=</span><span className="kw">True</span><span className="punct">,</span>{" "}<span className="var">data</span><span className="punct">=</span><span className="var">findings</span><span className="punct">,</span>{" "}<span className="var">confidence</span><span className="punct">=</span><span className="num">0.85</span><span className="punct">)</span>
      </>
    ),
    hints: [
      { type: "blast", files: 21 } as LineHint,
    ],
  },
  { no: 15, code: null },
  {
    no: 16,
    code: (
      <>
        {"    "}<span className="com">{"# dead — legacy Joern bridge removed in RFC-041"}</span>
      </>
    ),
  },
  {
    no: 17,
    code: (
      <>
        {"    "}<span className="kw">def </span>
        <HoverSymbol info={{ name: "_joern_cpg_bridge", kind: "function", callers: 0, blame: { author: "@devops-bot", when: "6mo ago" }, detail: "CPG-based analysis via Joern. Removed when semgrep path matured in RFC-041. Zero callers — dead code." }}>
          <span className="fn">_joern_cpg_bridge</span>
        </HoverSymbol>
        <span className="punct">(</span><span className="kw">self</span><span className="punct">):</span>{" "}<span className="com">{"..."}</span>
      </>
    ),
    hints: [
      { type: "stale", age: "stale 6mo" } as LineHint,
      { type: "callers", count: 0 } as LineHint,
    ],
  },
];

export const CHARGE_CALL_GRAPH: CallNode[] = [
  { name: "_analyze_taint_path_control_flow", depth: 0 },
  { name: "_build_cfg", depth: 1 },
  { name: "_run_semgrep_analysis", depth: 1, tag: "write" },
  { name: "_identify_security_guards", depth: 1, isLast: true },
];

export const CHARGE_DATA_FLOW: FlowStep[] = [
  { group: "security", step: "target", tag: "source" },
  { group: "security", step: "_build_cfg" },
  { group: "security", step: "_run_semgrep_analysis", tag: "sink", sink: true },
];
