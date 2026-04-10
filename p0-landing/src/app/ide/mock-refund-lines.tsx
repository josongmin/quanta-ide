import { HoverSymbol, type CodeLine, type LineHint  } from "@/widgets/ide-editor";

export const REFUND_LINES: CodeLine[] = [
  /* ── Line 1: stdlib imports ── */
  {
    no: 1,
    code: (
      <>
        <span className="kw">import</span>{" "}
        <HoverSymbol info={{ name: "asyncio", kind: "import", origin: "stdlib/asyncio", detail: "Async I/O event loop. Used for await chains throughout the orchestrator pipeline.", tags: ["external"] }}>
          <span className="var">asyncio</span>
        </HoverSymbol>
        <span className="punct">,</span>{" "}
        <HoverSymbol info={{ name: "logging", kind: "import", origin: "stdlib/logging", detail: "Standard logging. Log level inconsistency: DEBUG in strategy selection, ERROR in sink paths only." }}>
          <span className="var">logging</span>
        </HoverSymbol>
        <span className="punct">,</span>{" "}
        <HoverSymbol info={{ name: "time", kind: "import", origin: "stdlib/time", detail: "Used for latency sampling in _select_strategy. Not monotonic — clock skew possible under NTP." }}>
          <span className="var">time</span>
        </HoverSymbol>
      </>
    ),
  },

  /* ── Line 2: domain models import ── */
  {
    no: 2,
    code: (
      <>
        <span className="kw">from</span>{" "}
        <HoverSymbol info={{ name: "codegraph_agent.domain.models", kind: "import", origin: "domain/models.py", callers: 31, detail: "Core domain models: AgentTask, WorkflowResult, WorkflowState. All orchestrators depend on this." }}>
          <span className="str">codegraph_agent.domain.models</span>
        </HoverSymbol>
        {" "}<span className="kw">import</span>{" "}
        <HoverSymbol info={{ name: "AgentTask", kind: "type", usedBy: 14, detail: "Task descriptor passed into all orchestrators. Contains strategy hint, priority, and raw payload. No schema validation on payload field." }}>
          <span className="var">AgentTask</span>
        </HoverSymbol>
        <span className="punct">,</span>{" "}
        <HoverSymbol info={{ name: "WorkflowResult", kind: "type", usedBy: 19, branchCoverage: "4/6 branches", detail: "Workflow execution result. success/failure/partial states. Partial state handling untested (2/6 branches)." }}>
          <span className="var">WorkflowResult</span>
        </HoverSymbol>
      </>
    ),
  },

  /* ── Line 3: routing policy import ── */
  {
    no: 3,
    code: (
      <>
        <span className="kw">from</span>{" "}
        <HoverSymbol info={{ name: "codegraph_agent.orchestrator.routing_policy", kind: "import", origin: "orchestrator/routing_policy.py", detail: "Routes tasks to System 1 (fast) or System 2 (deep) based on complexity/risk scoring." }}>
          <span className="str">codegraph_agent.orchestrator.routing_policy</span>
        </HoverSymbol>
        {" "}<span className="kw">import</span>{" "}
        <HoverSymbol info={{ name: "DeepReasoningRoutingPolicy", kind: "class", callers: 3, methodCount: 6, fieldCount: 2, detail: "Stateless policy class. Routes by confidence threshold (0.6). HYBRID path not implemented — falls through to SYSTEM_2_DEEP silently." }}>
          <span className="var">DeepReasoningRoutingPolicy</span>
        </HoverSymbol>
      </>
    ),
  },

  /* ── Line 4: reasoning primitives ── */
  {
    no: 4,
    code: (
      <>
        <span className="kw">from</span>{" "}
        <HoverSymbol info={{ name: "codegraph_agent.shared.reasoning", kind: "import", origin: "shared/reasoning.py", taint: "source", detail: "ReflectionVerdict and ReasoningPath come from here — unvalidated strategy selection can propagate here.", tags: ["taint-source"] }}>
          <span className="str">codegraph_agent.shared.reasoning</span>
        </HoverSymbol>
        {" "}<span className="kw">import</span>{" "}
        <HoverSymbol info={{ name: "ReasoningDecision", kind: "type", usedBy: 7, branchCoverage: "3/8 branches", detail: "Routing decision enum: SYSTEM_1_FAST | SYSTEM_2_DEEP | HYBRID. Branch coverage 3/8 — HYBRID path untested." }}>
          <span className="var">ReasoningDecision</span>
        </HoverSymbol>
        <span className="punct">,</span>{" "}
        <HoverSymbol info={{ name: "ReflectionVerdict", kind: "type", usedBy: 4, taint: "source", detail: "Verdict from reflection loop. Can carry arbitrary metadata dict — not schema-validated before use as routing signal.", tags: ["taint-source"] }}>
          <span className="var">ReflectionVerdict</span>
        </HoverSymbol>
      </>
    ),
    hints: [
      { type: "taint-flow", from: "request.task", to: "experience_store" } as LineHint,
    ],
  },

  /* ── Line 5: blank ── */
  { no: 5, code: <></> },

  /* ── Line 6: class definition ── */
  {
    no: 6,
    risk: 4,
    context: { lineNo: 6, risk: 4, summary: "Class definition — 1,974 lines, CPX 9.1", detail: "DeepReasoningOrchestrator: multi-strategy execution engine. System 1/2 routing, beam/o1/debate/ToT strategies, Experience Store writes." },
    code: (
      <>
        <span className="kw">class </span>
        <HoverSymbol info={{ name: "DeepReasoningOrchestrator", kind: "class", methodCount: 24, fieldCount: 8, callers: 12, churn: 14, churnRisk: "high", coupledFiles: ["routing_policy.py", "audit_store.py"], blame: { author: "@songmin", when: "2w ago" }, detail: "1,974-line orchestrator. 24 methods, 8 fields. Executes beam/o1/debate/alphacode strategies. No rollback on partial failure.", tags: ["hot-path", "no-tests", "high-churn"] }}>
          <span className="fn">DeepReasoningOrchestrator</span>
        </HoverSymbol>
        <span className="punct">:</span>
      </>
    ),
    hints: [
      { type: "complexity", value: 9.1 } as LineHint,
      { type: "coverage", passed: 0, total: 12 } as LineHint,
      { type: "author", name: "@songmin", when: "2w" } as LineHint,
    ],
  },

  /* ── Line 7: comment — RFC ref ── */
  {
    no: 7,
    risk: 3,
    code: (
      <>
        {"    "}<span className="com">{"# V8 main execution pipeline (RFC-016)"}</span>
      </>
    ),
  },

  /* ── Line 8: execute() definition ── */
  {
    no: 8,
    risk: 4,
    context: { lineNo: 8, risk: 4, summary: "execute() — primary entrypoint, 12 callers", detail: "Router decision → strategy selection → execution → Experience Store write. No atomic rollback. LLMError falls back to v7 without guaranteed state cleanup." },
    code: (
      <>
        {"    "}<span className="kw">async def </span>
        <HoverSymbol info={{ name: "execute", kind: "function", riskScore: 78, complexity: 9.1, callers: 12, callees: 5, churn: 12, churnRisk: "high", coupledFiles: ["routing_policy.py", "audit_store.py", "security.py"], blame: { author: "@songmin", when: "2w ago" }, detail: "12 callers, 0 tested. Tainted strategy flows into experience_store.save() without validation.", tags: ["no-tests", "hot-path", "high-churn"] }}>
          <span className="fn">execute</span>
        </HoverSymbol>
        <span className="punct">(</span><span className="kw">self</span><span className="punct">,</span>{" "}
        <HoverSymbol info={{ name: "request", kind: "parameter", taint: "source", origin: "DeepReasoningRequest", flowsTo: "experience_store.save (L12)", validated: false, detail: "Unvalidated request object. strategy field is not enum-checked before routing." }}>
          <span className="var">request</span>
        </HoverSymbol>
        <span className="punct">: </span>
        <HoverSymbol info={{ name: "DeepReasoningRequest", kind: "type", usedBy: 8, detail: "Request dataclass. Contains task: AgentTask, strategy: str | None, priority: int. strategy is an unchecked string — not validated against ReasoningDecision enum." }}>
          <span className="var">DeepReasoningRequest</span>
        </HoverSymbol>
        <span className="punct">) -&gt; </span>
        <HoverSymbol info={{ name: "DeepReasoningResponse", kind: "type", usedBy: 12, detail: "Response dataclass. __post_init__ validates success field but not metadata contents. Callers check success only — metadata blindly forwarded." }}>
          <span className="var">DeepReasoningResponse</span>
        </HoverSymbol>
        <span className="punct">:</span>
      </>
    ),
    hints: [
      { type: "callers", count: 12, warn: true } as LineHint,
      { type: "warn-badge", label: "no rollback" } as LineHint,
    ],
  },

  /* ── Line 9: decision = await self._decide_reasoning_path ── */
  {
    no: 9,
    risk: 3,
    code: (
      <>
        {"        "}
        <HoverSymbol info={{ name: "decision", kind: "variable", detail: "ReasoningDecision enum value. Assigned from _decide_reasoning_path — confidence < 0.6 defaults to SYSTEM_2_DEEP without logging the fallback." }}>
          <span className="var">decision</span>
        </HoverSymbol>
        {" "}<span className="punct">=</span>{" "}<span className="kw">await </span>
        <span className="kw">self</span><span className="punct">.</span>
        <HoverSymbol info={{ name: "_decide_reasoning_path", kind: "call-site", callee: "_decide_reasoning_path", callDepth: 3, detail: "Routes to System 1 (fast) or System 2 (deep). Confidence score below 0.6 defaults to System 2 without logging." }}>
          <span className="fn">_decide_reasoning_path</span>
        </HoverSymbol>
        <span className="punct">(</span>
        <HoverSymbol info={{ name: "request", kind: "variable", taint: "source", detail: "Same request object from execute() parameter. Carries unvalidated strategy and task fields." }}>
          <span className="var">request</span>
        </HoverSymbol>
        <span className="punct">.</span>
        <HoverSymbol info={{ name: "task", kind: "property", taint: "source", origin: "DeepReasoningRequest.task", detail: "AgentTask payload extracted from request. Passed directly to routing without validation — strategy field is an unchecked string." }}>
          <span className="var">task</span>
        </HoverSymbol>
        <span className="punct">)</span>
      </>
    ),
  },

  /* ── Line 10: strategy = await self._select_strategy ── */
  {
    no: 10,
    risk: 4,
    code: (
      <>
        {"        "}
        <HoverSymbol info={{ name: "strategy", kind: "variable", taint: "passthrough", detail: "Strategy object passed from routing through to execution. Carries tainted fields from request — not re-validated at this boundary.", tags: ["hot-path"] }}>
          <span className="var">strategy</span>
        </HoverSymbol>
        {" "}<span className="punct">=</span>{" "}<span className="kw">await </span>
        <span className="kw">self</span><span className="punct">.</span>
        <HoverSymbol info={{ name: "_select_strategy", kind: "call-site", callee: "_select_strategy", callDepth: 4, taint: "passthrough", detail: "Selects beam/o1/debate/alphacode. Falls back to BEAM on unknown strategy string — no exception raised.", tags: ["hot-path"] }}>
          <span className="fn">_select_strategy</span>
        </HoverSymbol>
        <span className="punct">(</span>
        <HoverSymbol info={{ name: "request", kind: "variable", taint: "source", detail: "Unvalidated request forwarded into strategy selection. strategy field not enum-checked at this boundary." }}>
          <span className="var">request</span>
        </HoverSymbol>
        <span className="punct">,</span>{" "}
        <HoverSymbol info={{ name: "decision", kind: "variable", detail: "ReasoningDecision enum value from _decide_reasoning_path. Confidence < 0.6 defaults to SYSTEM_2_DEEP silently." }}>
          <span className="var">decision</span>
        </HoverSymbol>
        <span className="punct">)</span>
      </>
    ),
  },

  /* ── Line 11: comment ── */
  {
    no: 11,
    code: (
      <>
        {"        "}<span className="com">{"# ... strategy execution (beam / o1 / debate / alphacode)"}</span>
      </>
    ),
  },

  /* ── Line 12: experience_store.save(result) ── */
  {
    no: 12,
    risk: 4,
    context: { lineNo: 12, risk: 4, summary: "Taint sink — strategy result written to experience store", detail: "result.metadata carries unvalidated strategy field from request. Persisted to PostgreSQL without schema validation." },
    code: (
      <>
        {"        "}<span className="kw">await </span>
        <HoverSymbol info={{ name: "experience_store", kind: "variable", taint: "sink", callers: 8, detail: "PostgreSQL ExperienceRepository. Writes agent_experience rows. Not wrapped in a transaction with the WorkflowResult write." }}>
          <span className="var">experience_store</span>
        </HoverSymbol>
        <span className="punct">.</span>
        <HoverSymbol info={{ name: "save", kind: "function", taint: "sink", callers: 8, origin: "request.task (L8)", riskScore: 78, detail: "Final taint sink. strategy + task metadata persisted without validation. 8 callers, 0 tested.", tags: ["no-tests", "write"] }}>
          <span className="fn">save</span>
        </HoverSymbol>
        <span className="punct">(</span>
        <HoverSymbol info={{ name: "result", kind: "variable", taint: "sink", detail: "WorkflowResult carrying execution output + metadata. metadata dict is untyped — any fields from request propagate here unchecked." }}>
          <span className="var">result</span>
        </HoverSymbol>
        <span className="punct">)</span>
      </>
    ),
    hints: [
      { type: "callers", count: 8, warn: true } as LineHint,
      { type: "warn-badge", label: "no transaction" } as LineHint,
    ],
  },

  /* ── Line 13: return DeepReasoningResponse(...) ── */
  {
    no: 13,
    risk: 2,
    code: (
      <>
        {"        "}<span className="kw">return </span>
        <HoverSymbol info={{ name: "DeepReasoningResponse", kind: "call-site", callee: "DeepReasoningResponse.__init__", callDepth: 1, detail: "Constructs response. __post_init__ validates success field but not metadata. Downstream callers receive metadata blindly." }}>
          <span className="var">DeepReasoningResponse</span>
        </HoverSymbol>
        <span className="punct">(</span>
        <HoverSymbol info={{ name: "success", kind: "parameter", validated: true, origin: "bool", detail: "Validated by __post_init__. Always True at this point — partial failure not surfaced to caller." }}>
          <span className="var">success</span>
        </HoverSymbol>
        <span className="punct">=</span><span className="kw">True</span><span className="punct">,</span>{" "}
        <HoverSymbol info={{ name: "workflow_result", kind: "parameter", taint: "sink", origin: "WorkflowResult", validated: false, detail: "Carries unvalidated metadata from execute(). Propagates taint to all 38 downstream callers via response object." }}>
          <span className="var">workflow_result</span>
        </HoverSymbol>
        <span className="punct">=</span><span className="var">result</span><span className="punct">)</span>
      </>
    ),
    hints: [
      { type: "blast", files: 38 } as LineHint,
    ],
  },

  /* ── Line 14: blank ── */
  { no: 14, code: <></> },

  /* ── Line 15: dead code comment ── */
  {
    no: 15,
    code: (
      <>
        {"    "}<span className="com">{"# dead — legacy inference bridge removed in v8"}</span>
      </>
    ),
  },

  /* ── Line 16: _legacy_inference_bridge ── */
  {
    no: 16,
    code: (
      <>
        {"    "}<span className="kw">def </span>
        <HoverSymbol info={{ name: "_legacy_inference_bridge", kind: "function", callers: 0, blame: { author: "@devops-bot", when: "5mo ago" }, detail: "Raises RuntimeError on call. Legacy bridge removed when v8 shipped. Zero callers — dead code.", tags: ["dead", "stale"] }}>
          <span className="fn">_legacy_inference_bridge</span>
        </HoverSymbol>
        <span className="punct">(</span><span className="kw">self</span><span className="punct">):</span>{" "}<span className="com">{"..."}</span>
      </>
    ),
    hints: [
      { type: "stale", age: "stale 5mo" } as LineHint,
      { type: "callers", count: 0 } as LineHint,
    ],
  },
];
