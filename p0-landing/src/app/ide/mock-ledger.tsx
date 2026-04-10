import { HoverSymbol, type CodeLine, type LineHint  } from "@/widgets/ide-editor";
import type { CallNode } from "@/features/ide-call-graph";
import type { FlowStep } from "@/features/ide-data-flow";

export const LEDGER_LINES: CodeLine[] = [
  {
    no: 1,
    code: (
      <>
        <span className="kw">import</span> <span className="var">json</span><span className="punct">,</span> <span className="var"> sqlite3</span>
      </>
    ),
  },
  {
    no: 2,
    code: (
      <>
        <span className="kw">from</span> <span className="str">pathlib</span> <span className="kw">import</span> <span className="var">Path</span>
      </>
    ),
  },
  {
    no: 3,
    code: (
      <>
        <span className="kw">from</span>{" "}
        <HoverSymbol info={{ name: "pydantic", kind: "import", origin: "pydantic>=2.0", callers: 22, detail: "Pydantic v2. BaseModel + field_validator for JSON-serializable audit fields. Used in 22 models." }}>
          <span className="str">pydantic</span>
        </HoverSymbol>
        {" "}<span className="kw">import</span> <span className="var">BaseModel</span><span className="punct">,</span> <span className="var"> Field</span><span className="punct">,</span> <span className="var"> field_validator</span>
      </>
    ),
  },
  { no: 4, code: <></> },
  {
    no: 5,
    risk: 2,
    context: { lineNo: 5, risk: 2, summary: "RequestAuditLog — RFC-027 §9.1 model", detail: "Pydantic BaseModel for audit log storage. All dicts validated as JSON-serializable. 5/5 tested." },
    code: (
      <>
        <span className="kw">class </span>
        <HoverSymbol info={{ name: "RequestAuditLog", kind: "function", complexity: 2.4, callers: 5, blame: { author: "@songmin", when: "1mo ago" }, detail: "RFC-027 §9.1 audit record. Stores request_id, input_spec, resolved_spec, engine_versions, llm_decisions, tool_trace. All fields JSON-validated.", tags: ["hot-path"] }}>
          <span className="fn">RequestAuditLog</span>
        </HoverSymbol>
        <span className="punct">(</span><span className="var">BaseModel</span><span className="punct">):</span>
      </>
    ),
    hints: [
      { type: "complexity", value: 2.4 } as LineHint,
      { type: "coverage", passed: 5, total: 5 } as LineHint,
    ],
  },
  {
    no: 6,
    code: (
      <>
        {"    "}<span className="var">request_id</span><span className="punct">:</span> <span className="var">str</span>{" "}<span className="punct">=</span>{" "}<span className="fn">Field</span><span className="punct">(...</span><span className="punct">,</span> <span className="var">min_length</span><span className="punct">=</span><span className="num">1</span><span className="punct">)</span>
      </>
    ),
  },
  {
    no: 7,
    code: (
      <>
        {"    "}<span className="var">input_spec</span><span className="punct">:</span> <span className="var">dict</span><span className="punct">[</span><span className="var">str</span><span className="punct">,</span> <span className="var">Any</span><span className="punct">]</span>
      </>
    ),
  },
  {
    no: 8,
    code: (
      <>
        {"    "}<span className="var">engine_versions</span><span className="punct">:</span> <span className="var">dict</span><span className="punct">[</span><span className="var">str</span><span className="punct">,</span> <span className="var">str</span><span className="punct">]</span>{" "}<span className="punct">=</span>{" "}<span className="fn">Field</span><span className="punct">(</span><span className="var">default_factory</span><span className="punct">=</span><span className="var">dict</span><span className="punct">)</span>
      </>
    ),
  },
  {
    no: 9,
    code: (
      <>
        {"    "}<span className="var">duration_ms</span><span className="punct">:</span> <span className="var">float</span>{" "}<span className="punct">=</span>{" "}<span className="fn">Field</span><span className="punct">(</span><span className="var">default</span><span className="punct">=</span><span className="num">0.0</span><span className="punct">,</span> <span className="var">ge</span><span className="punct">=</span><span className="num">0.0</span><span className="punct">)</span>
      </>
    ),
  },
  { no: 10, code: <></> },
  {
    no: 11,
    risk: 2,
    context: { lineNo: 11, risk: 2, summary: "AuditStore — SQLite RFC-027 §9 storage", detail: "Thread-safe SQLite store. Each operation creates a new connection. Auto-creates audit_logs schema on init." },
    code: (
      <>
        <span className="kw">class </span>
        <HoverSymbol info={{ name: "AuditStore", kind: "function", complexity: 2.4, callers: 5, blame: { author: "@songmin", when: "1mo ago" }, detail: "RFC-027 §9 audit storage. Thread-safe via per-operation connections. SQLite for dev; schema is PostgreSQL-ready.", tags: ["hot-path"] }}>
          <span className="fn">AuditStore</span>
        </HoverSymbol>
        <span className="punct">:</span>
      </>
    ),
    hints: [
      { type: "author", name: "@songmin", when: "1mo" } as LineHint,
    ],
  },
  {
    no: 12,
    code: (
      <>
        {"    "}<span className="com">{"# RFC-027 §9 — SQLite, thread-safe, auto-schema"}</span>
      </>
    ),
  },
  {
    no: 13,
    risk: 2,
    context: { lineNo: 13, risk: 2, summary: "store_request() — primary write entrypoint", detail: "INSERT OR REPLACE into audit_logs. Serializes all dict fields to JSON. Raises ValueError on failure." },
    code: (
      <>
        {"    "}<span className="kw">def </span>
        <HoverSymbol info={{ name: "store_request", kind: "function", riskScore: 23, complexity: 2.4, callers: 5, blame: { author: "@songmin", when: "1mo ago" }, detail: "Saves RequestAuditLog to SQLite. All 5 callers tested. No taint path — log is internally constructed.", tags: ["hot-path"] }}>
          <span className="fn">store_request</span>
        </HoverSymbol>
        <span className="punct">(</span><span className="kw">self</span><span className="punct">,</span>{" "}
        <HoverSymbol info={{ name: "log", kind: "variable", origin: "RequestAuditLog", detail: "Validated Pydantic model. All fields JSON-serializable by field_validator. Safe to persist." }}>
          <span className="var">log</span>
        </HoverSymbol>
        <span className="punct">: </span><span className="var">RequestAuditLog</span><span className="punct">) -&gt; </span><span className="kw">None</span><span className="punct">:</span>
      </>
    ),
    hints: [
      { type: "coverage", passed: 5, total: 5 } as LineHint,
    ],
  },
  {
    no: 14,
    code: (
      <>
        {"        "}<span className="var">conn</span>{" "}<span className="punct">=</span>{" "}<span className="kw">self</span><span className="punct">.</span>
        <HoverSymbol info={{ name: "_get_connection", kind: "function", callers: 3, detail: "Returns sqlite3.connect(check_same_thread=False). Row factory set to sqlite3.Row for dict-like access." }}>
          <span className="fn">_get_connection</span>
        </HoverSymbol>
        <span className="punct">()</span>
      </>
    ),
  },
  {
    no: 15,
    risk: 2,
    context: { lineNo: 15, risk: 2, summary: "INSERT OR REPLACE — audit_logs table", detail: "10-column INSERT. JSON-serializes dict fields. timestamp as ISO 8601. Raises ValueError on sqlite3.Error." },
    code: (
      <>
        {"        "}<span className="var">conn</span><span className="punct">.</span>
        <HoverSymbol info={{ name: "execute", kind: "function", taint: "sink", callers: 5, detail: "INSERT OR REPLACE into audit_logs. Parameterized query — no SQL injection risk. All dict fields pre-validated.", tags: ["write"] }}>
          <span className="fn">execute</span>
        </HoverSymbol>
        <span className="punct">(</span><span className="str">{"\"INSERT OR REPLACE INTO audit_logs ...\""}</span><span className="punct">,</span>{" "}<span className="var">params</span><span className="punct">)</span>
      </>
    ),
    hints: [
      { type: "callers", count: 5 } as LineHint,
    ],
  },
  {
    no: 16,
    code: (
      <>
        {"        "}<span className="var">conn</span><span className="punct">.</span><span className="fn">commit</span><span className="punct">()</span>
      </>
    ),
    hints: [
      { type: "blast", files: 8 } as LineHint,
    ],
  },
];

export const LEDGER_CALL_GRAPH: CallNode[] = [
  { name: "store_request", depth: 0 },
  { name: "_get_connection", depth: 1 },
  { name: "conn.execute", depth: 1, tag: "write" },
  { name: "conn.commit", depth: 1, isLast: true },
];

export const LEDGER_DATA_FLOW: FlowStep[] = [
  { group: "audit", step: "RequestAuditLog", tag: "source" },
  { group: "audit", step: "json.dumps" },
  { group: "audit", step: "conn.execute", tag: "sink", sink: true },
];
