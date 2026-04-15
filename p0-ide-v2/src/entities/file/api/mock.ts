import type { FileFacts } from "../model/types";

export const ORCHESTRATOR_SOURCE = `class DeepReasoningOrchestrator:
    """Coordinates multi-step reasoning across analysis ports."""

    def __init__(self, strategy: Strategy, store: ExperienceStore) -> None:
        self._strategy = strategy
        self._store = store

    def execute(self, request: Request) -> Response:
        plan = self._strategy.select(request)
        trace = []
        for step in plan.steps:
            result = step.run(request.ctx)
            trace.append(result)
            if result.is_terminal():
                break
        self._store.save(trace)            # ← taint sink
        return Response(trace=trace, plan=plan)

    def _select_strategy(self, kind: str) -> Strategy:
        if kind == "fast":
            return self._strategy.fast
        return self._strategy.deep
`;

export const ORCHESTRATOR: FileFacts = {
  name: "orchestrator.py",
  loc: 1974,
  blast: 38,
  blastCritical: 3,
  taintCount: 2,
  cpxMax: 9,
  cpxBudgetPct: 91,
  archViolations: 0,
  deadCount: 1,
  riskScore: 78,
  lastModified: "2w",
  owner: "@songmin",
  ownership: [
    { author: "@songmin", pct: 81, role: "primary" },
    { author: "@devops-bot", pct: 19, role: "contributor" },
  ],

  symbols: [
    {
      name: "DeepReasoningOrchestrator",
      kind: "class",
      detail: "Coordinates multi-step reasoning across analysis ports.",
      line: 1,
      layer: "app",
      role: "Orchestrator",
      contract: { verb: "implements", name: "ReasoningPort" },
      why: { label: "RFC-02 · deep reasoning pipeline" },
      riskScore: 78,
      complexity: 9,
      callers: 12,
      callees: 6,
      blast: 38,
      blastCritical: 3,
      stability: 0.71,
      churn90d: 14,
      heat: { level: "hot", rate: "820/min" },
      tests: "0/12",
      blame: { author: "@songmin", when: "2w" },
      tags: ["hotspot", "untested"],
      incidentMatch: { id: "INC-31", similarity: 0.71, reason: "cpx-spike drift" },
    },
    {
      name: "execute",
      kind: "method",
      detail: "Runs the selected strategy plan and stores the trace.",
      line: 8,
      layer: "app",
      why: { label: "RFC-02 §3 · plan → run → persist" },
      riskScore: 78,
      complexity: 9,
      bigO: "O(n)",
      callers: 12,
      callees: 4,
      blast: 31,
      blastCritical: 3,
      stability: 0.78,
      churn90d: 9,
      heat: { level: "hot", rate: "820/min" },
      tests: "0/12",
      taint: "sink",
      blame: { author: "@songmin", when: "2w" },
      tags: ["taint-sink", "no-tests"],
      incidentMatch: { id: "INC-47", similarity: 0.87, reason: "same source→sink shape" },
      flowsTo: [
        { line: 9, symbol: "request", hop: "source: request.ctx" },
        { line: 12, symbol: "step.run", hop: "propagate: request.ctx → result" },
        { line: 13, symbol: "trace", hop: "propagate: result → trace" },
        { line: 16, symbol: "_store.save", hop: "sink: trace → save(unvalidated)" },
      ],
      deps: {
        incoming: [
          { name: "HTTPController.handle", layer: "adapter" },
          { name: "WebhookController.receive", layer: "adapter" },
          { name: "ReplayService.step", layer: "app" },
        ],
        outgoing: [
          { name: "Strategy.run", layer: "domain" },
          { name: "ExperienceStore.save", layer: "infra" },
          { name: "Tracer.emit", layer: "infra" },
        ],
        incomingTotal: 12,
        outgoingTotal: 4,
      },
      hotPath: { label: "ingest → reason → persist", rank: 1, total: 18 },
      lastRiskyChange: {
        sha: "1a9c73f",
        author: "@songmin",
        when: "2w",
        risk: 85,
        summary: "inlined trace forwarding — skipped validate_trace()",
      },
      relatedIncidents: [
        { id: "INC-412", similarity: 0.91, when: "2mo" },
        { id: "INC-47", similarity: 0.87, when: "6mo" },
        { id: "INC-31", similarity: 0.71, when: "9mo" },
      ],
    },
    {
      name: "_select_strategy",
      kind: "method",
      detail: "Picks fast vs deep strategy based on request kind.",
      line: 19,
      riskScore: 38,
      complexity: 4,
      bigO: "O(1)",
      callers: 1,
      tests: "0/1",
      blame: { author: "@songmin", when: "3w" },
    },
    {
      name: "Strategy",
      kind: "class",
      detail: "Abstract reasoning strategy port (fast | deep).",
      line: 0,
      riskScore: 12,
      blame: { author: "@devops-bot", when: "1mo" },
    },
    {
      name: "ExperienceStore",
      kind: "class",
      detail: "Persists reasoning traces for later replay.",
      line: 23,
      layer: "infra",
      role: "Store",
      contract: { verb: "implements", name: "ExperiencePort" },
      why: { label: "ADR-14 · persistent reasoning memory" },
      riskScore: 23,
      complexity: 4,
      bigO: "O(1)",
      callers: 5,
      callees: 2,
      blast: 17,
      blastCritical: 1,
      stability: 0.28,
      churn90d: 2,
      heat: { level: "hot", rate: "1.2k/min" },
      tests: "5/5",
      blame: { author: "@songmin", when: "1mo" },
      incidentMatch: { id: "INC-47", similarity: 0.87, reason: "same source→sink shape" },
      tags: ["port-impl", "stable"],
      deps: {
        incoming: [
          { name: "DeepReasoningOrchestrator.execute", layer: "app" },
          { name: "ReplayService.replay", layer: "app" },
          { name: "AuditStore.snapshot", layer: "infra" },
        ],
        outgoing: [
          { name: "trace_schema.validate", layer: "domain" },
          { name: "postgres.exec", layer: "infra" },
        ],
        incomingTotal: 5,
        outgoingTotal: 2,
      },
      hotPath: { label: "ingest → reason → persist", rank: 2, total: 18 },
      lastRiskyChange: {
        sha: "8c40a1d",
        author: "@songmin",
        when: "3w",
        risk: 72,
        summary: "removed validate_trace() from save() — perf pass",
      },
      relatedIncidents: [
        { id: "INC-412", similarity: 0.91, when: "2mo" },
        { id: "INC-47", similarity: 0.87, when: "6mo" },
      ],
    },
    {
      name: "Request",
      kind: "class",
      detail: "Inbound reasoning request payload.",
      line: 0,
      riskScore: 8,
      blame: { author: "@songmin", when: "1mo" },
    },
    {
      name: "Response",
      kind: "class",
      detail: "Outbound reasoning response with trace + plan.",
      line: 0,
      riskScore: 8,
      blame: { author: "@songmin", when: "1mo" },
    },
    {
      name: "strategy",
      kind: "parameter",
      detail: "Injected Strategy port.",
      line: 4,
      taint: "source",
      tags: ["taint-source"],
    },
    {
      name: "store",
      kind: "parameter",
      detail: "Injected ExperienceStore port.",
      line: 4,
    },
    {
      name: "request",
      kind: "parameter",
      detail: "Inbound Request — carries untrusted ctx.",
      line: 8,
      taint: "source",
      tags: ["taint-source"],
    },
    {
      name: "plan",
      kind: "variable",
      detail: "Resolved execution plan from the strategy.",
      line: 9,
    },
    {
      name: "trace",
      kind: "variable",
      detail: "Ordered step results — flows into store.save (sink).",
      line: 10,
      taint: "passthrough",
    },
  ],

  functionHeaders: [
    {
      line: 1,
      name: "DeepReasoningOrchestrator",
      kind: "class",
      blast: 38,
      complexity: 9,
      tests: "0/12",
      owner: "@songmin",
      riskScore: 78,
      budgetPct: 91,
    },
    {
      line: 4,
      name: "__init__",
      kind: "method",
      blast: 2,
      complexity: 1,
      bigO: "O(1)",
      tests: "0/0",
      owner: "@songmin",
      riskScore: 8,
    },
    {
      line: 8,
      name: "execute",
      kind: "method",
      blast: 31,
      blastCritical: 3,
      complexity: 9,
      bigO: "O(n)",
      tests: "0/12",
      owner: "@songmin",
      taint: "sink",
      riskScore: 78,
      budgetPct: 91,
    },
    {
      line: 19,
      name: "_select_strategy",
      kind: "method",
      blast: 3,
      complexity: 4,
      bigO: "O(1)",
      tests: "0/1",
      owner: "@songmin",
      riskScore: 38,
    },
  ],

  gutter: [
    { line: 4, glyph: "taint-source", title: "taint source: strategy (injected port)" },
    { line: 8, glyph: "taint-source", title: "taint source: request.ctx" },
    { line: 12, glyph: "taint-through", title: "propagates: step.run(request.ctx)" },
    { line: 13, glyph: "taint-through", title: "propagates: trace.append(result)" },
    { line: 16, glyph: "taint-sink", title: "taint sink: _store.save(trace) — unvalidated" },
    { line: 16, glyph: "incident-match", title: "matches incident #47 (2024-11-15): db_use_after_close" },
  ],

  minimap: [
    { line: 1, severity: 4, kind: "blast" },
    { line: 4, severity: 2, kind: "taint" },
    { line: 8, severity: 4, kind: "taint" },
    { line: 9, severity: 3, kind: "cpx" },
    { line: 12, severity: 3, kind: "taint" },
    { line: 13, severity: 2, kind: "taint" },
    { line: 14, severity: 2, kind: "cpx" },
    { line: 16, severity: 4, kind: "taint" },
    { line: 19, severity: 2, kind: "cpx" },
  ],

  imports: [],

  callSites: [
    {
      line: 9,
      callee: "Strategy.select",
      calleeFile: "ports/strategy.py",
      effects: ["pure"],
    },
    {
      line: 12,
      callee: "Step.run",
      calleeFile: "ports/step.py",
      effects: ["io:read"],
      taintPath: {
        id: "tp-step",
        owasp: "A03 (Injection)",
        severity: 2,
        steps: [
          { line: 8, symbol: "request", hop: "source", detail: "inbound request.ctx" },
          { line: 12, symbol: "step.run", hop: "propagate", detail: "passes ctx to step implementation" },
        ],
      },
    },
    {
      line: 16,
      callee: "ExperienceStore.save",
      calleeFile: "infra/experience_store.py",
      effects: ["io:write", "persist"],
      taintPath: {
        id: "tp-sink",
        owasp: "A03 (Injection)",
        severity: 3,
        steps: [
          { line: 8, symbol: "request", hop: "source", detail: "untrusted request.ctx" },
          { line: 12, symbol: "step.run", hop: "propagate", detail: "ctx → result" },
          { line: 13, symbol: "trace", hop: "propagate", detail: "result → trace[]" },
          { line: 16, symbol: "_store.save", hop: "sink", detail: "save(trace) — no validation" },
        ],
        sanitizerHints: [
          "validate trace.origin before save",
          "schema-check trace with pydantic model",
          "require signed envelope from step.run",
        ],
      },
    },
  ],

  taintPaths: [
    {
      id: "tp-sink",
      owasp: "A03 (Injection)",
      severity: 3,
      steps: [
        { line: 8, symbol: "request", hop: "source", detail: "untrusted request.ctx" },
        { line: 12, symbol: "step.run", hop: "propagate", detail: "ctx → result" },
        { line: 13, symbol: "trace", hop: "propagate", detail: "result → trace[]" },
        { line: 16, symbol: "_store.save", hop: "sink", detail: "save(trace) — no validation" },
      ],
      sanitizerHints: [
        "validate trace.origin before save",
        "schema-check trace with pydantic model",
      ],
    },
    {
      id: "tp-strategy",
      owasp: "A04 (Insecure Design)",
      severity: 2,
      steps: [
        { line: 4, symbol: "strategy", hop: "source", detail: "injected strategy port" },
        { line: 20, symbol: "self._strategy.fast", hop: "branch", detail: "kind=='fast' path" },
        { line: 21, symbol: "self._strategy.deep", hop: "sink", detail: "default path — unchecked" },
      ],
    },
  ],

  blastTargets: [
    { file: "api/inference_router.py", riskScore: 72, callPath: ["inference_router.handle", "execute"], reason: "direct-caller" },
    { file: "api/stream_handler.py", riskScore: 61, callPath: ["stream_handler.stream", "execute"], reason: "direct-caller" },
    { file: "replay/router.py", riskScore: 48, callPath: ["router.replay_request", "execute"], reason: "direct-caller" },
    { file: "infra/experience_store.py", riskScore: 55, callPath: ["execute", "_store.save"], reason: "shared-data" },
    { file: "tests/integration/test_reasoning.py", riskScore: 12, callPath: ["test_reasoning", "execute"], reason: "test" },
    { file: "observability/trace_sink.py", riskScore: 34, callPath: ["trace_sink.record", "_store.save"], reason: "transitive-caller" },
    { file: "shared/reasoning.py", riskScore: 61, callPath: ["reasoning.compose", "execute"], reason: "transitive-caller" },
    { file: "domain/models.py", riskScore: 31, callPath: ["*", "Response"], reason: "shared-data" },
  ],

  incidents: [
    {
      id: "INC-47",
      date: "2024-11-15",
      title: "experience_store write stalled pipeline under malformed trace",
      patternKind: "taint",
      confidence: 0.87,
      matchDetail: "same source→sink shape: untrusted ctx → store.save without schema check",
      postmortemUrl: "incidents/INC-47",
    },
    {
      id: "INC-31",
      date: "2024-08-02",
      title: "orchestrator complexity regression caused 4x p95 latency",
      patternKind: "cpx-spike",
      confidence: 0.71,
      matchDetail: "execute() cpx 9 crossed team budget (8) — same signature drift as INC-31",
    },
  ],

  behaviorDiff: [
    { line: 9, kind: "syntax", summary: "whitespace" },
    { line: 13, kind: "semantic", summary: "trace.append reordered — now after terminal check was removed", before: "trace.append(result); if result.is_terminal(): break", after: "result = step.run(request.ctx); trace.append(result)" },
    { line: 16, kind: "runtime", summary: "new sink path — _store.save now reachable with unvalidated trace", before: "(no call)", after: "self._store.save(trace)" },
  ],
};

export const FILES: Record<string, FileFacts> = {
  "orchestrator.py": ORCHESTRATOR,
};
