/** Plain-text Python sources for the editable editor. */
import type { SymbolInfo } from "@/features/ide-editor-hover";

/**
 * Symbol name → hover info.
 * Used by CodeMirror hover handler to show SymbolTooltip on identifier hover.
 */
export const SYMBOL_INFO: Record<string, SymbolInfo> = {
  // ── orchestrator.py ──
  "execute": {
    name: "execute", kind: "function", riskScore: 78, complexity: 9.1, callers: 12, callees: 5,
    churn: 12, churnRisk: "high", coupledFiles: ["routing_policy.py", "audit_store.py", "security.py"],
    blame: { author: "@songmin", when: "2w ago" },
    detail: "12 callers, 0 tested. Tainted strategy flows into experience_store.save() without validation.",
    tags: ["no-tests", "hot-path", "high-churn"],
  },
  "DeepReasoningOrchestrator": {
    name: "DeepReasoningOrchestrator", kind: "class", methodCount: 24, fieldCount: 8, callers: 12,
    churn: 14, churnRisk: "high", coupledFiles: ["routing_policy.py", "audit_store.py"],
    blame: { author: "@songmin", when: "2w ago" },
    detail: "1,974-line orchestrator. 24 methods, 8 fields. Executes beam/o1/debate/alphacode strategies. No rollback on partial failure.",
    tags: ["hot-path", "no-tests", "high-churn"],
  },
  "_decide_reasoning_path": {
    name: "_decide_reasoning_path", kind: "function", complexity: 4.2, callers: 3,
    detail: "Routes to System 1 (fast) or System 2 (deep). Confidence < 0.6 defaults to SYSTEM_2_DEEP without logging.",
  },
  "_select_strategy": {
    name: "_select_strategy", kind: "function", complexity: 5.1, callers: 2, taint: "passthrough",
    detail: "Selects beam/o1/debate/alphacode. Falls back to BEAM on unknown strategy string — no exception raised.",
    tags: ["hot-path"],
  },
  "experience_store": {
    name: "experience_store", kind: "variable", taint: "sink", callers: 8,
    detail: "PostgreSQL ExperienceRepository. Writes agent_experience rows. Not wrapped in a transaction.",
  },
  "save": {
    name: "save", kind: "function", taint: "sink", callers: 8, riskScore: 78,
    detail: "Final taint sink. strategy + task metadata persisted without validation. 8 callers, 0 tested.",
    tags: ["no-tests", "write"],
  },
  "request": {
    name: "request", kind: "parameter", taint: "source", origin: "DeepReasoningRequest", validated: false,
    detail: "Unvalidated request object. strategy field is not enum-checked before routing.",
  },
  "DeepReasoningRequest": {
    name: "DeepReasoningRequest", kind: "type", usedBy: 8,
    detail: "Request dataclass. Contains task: AgentTask, strategy: str | None, priority: int. strategy is unchecked.",
  },
  "DeepReasoningResponse": {
    name: "DeepReasoningResponse", kind: "type", usedBy: 12,
    detail: "Response dataclass. __post_init__ validates success field but not metadata contents.",
  },
  "AgentTask": {
    name: "AgentTask", kind: "type", usedBy: 14,
    detail: "Task descriptor. Contains strategy hint, priority, and raw payload. No schema validation on payload.",
  },
  "WorkflowResult": {
    name: "WorkflowResult", kind: "type", usedBy: 19, branchCoverage: "4/6 branches",
    detail: "Workflow execution result. success/failure/partial states. Partial state handling untested (2/6 branches).",
  },
  "_legacy_inference_bridge": {
    name: "_legacy_inference_bridge", kind: "function", callers: 0,
    blame: { author: "@devops-bot", when: "5mo ago" },
    detail: "Raises RuntimeError on call. Legacy bridge removed when v8 shipped. Zero callers — dead code.",
    tags: ["dead", "stale"],
  },

  // ── routing_policy.py / security.py ──
  "AnalyzeControlFlowTool": {
    name: "AnalyzeControlFlowTool", kind: "class", methodCount: 5, fieldCount: 2, callers: 7,
    blame: { author: "@devops-bot", when: "3w ago" },
    detail: "Semgrep-based control-flow analyzer. Finds taint paths, security guards, and CFG reachability. 2/7 callers tested.",
    tags: ["hot-path"],
  },
  "_analyze_taint_path_control_flow": {
    name: "_analyze_taint_path_control_flow", kind: "function", riskScore: 52, complexity: 6.3, callers: 7,
    blame: { author: "@devops-bot", when: "3w ago" },
    detail: "Primary taint analysis dispatcher. target param is unvalidated user input — flows directly into semgrep subprocess call.",
    tags: ["no-tests", "hot-path"],
  },
  "_build_cfg": {
    name: "_build_cfg", kind: "function", complexity: 3.1, callers: 2,
    detail: "Builds CFG from AST. Uses astroid. Returns dict of BasicBlock nodes. Raises on syntax error.",
  },
  "_run_semgrep_analysis": {
    name: "_run_semgrep_analysis", kind: "function", taint: "sink", complexity: 4.2, callers: 1,
    detail: "Runs semgrep CLI via subprocess. target path is not normalized — path traversal possible. No allowlist check.",
    tags: ["write", "no-tests"],
  },
  "_identify_security_guards": {
    name: "_identify_security_guards", kind: "function", complexity: 2.8, callers: 1,
    detail: "Identifies sanitizers/validators in the CFG that protect sinks from tainted sources.",
  },
  "_joern_cpg_bridge": {
    name: "_joern_cpg_bridge", kind: "function", callers: 0,
    blame: { author: "@devops-bot", when: "6mo ago" },
    detail: "CPG-based analysis via Joern. Removed when semgrep path matured in RFC-041. Zero callers — dead code.",
    tags: ["dead", "stale"],
  },
  "target": {
    name: "target", kind: "parameter", taint: "source", origin: "StepToolRequest", validated: false,
    detail: "Unvalidated path string. Passed to semgrep CLI — path traversal possible if not sanitized.",
  },
  "StepTool": {
    name: "StepTool", kind: "class", methodCount: 8, fieldCount: 3,
    detail: "StepTool ABC + StepToolResult dataclass. All plan tools extend StepTool.",
  },
  "StepToolResult": {
    name: "StepToolResult", kind: "type", usedBy: 9,
    detail: "Result dataclass. confidence=0.85 if guards found, 0.65 otherwise.",
  },

  // ── audit_store.py ──
  "store_request": {
    name: "store_request", kind: "function", complexity: 2.1, callers: 5,
    detail: "Audit log writer. Inserts an AuditEntry into the SQLite audit table.",
  },
  "AuditEntry": {
    name: "AuditEntry", kind: "class", methodCount: 1, fieldCount: 4,
    detail: "Pydantic model for audit entries. event/actor/timestamp/payload. Validates non-empty event.",
  },
  "validate_event": {
    name: "validate_event", kind: "function", complexity: 1.5, callers: 1,
    detail: "Pydantic field_validator. Trims and rejects empty event strings.",
  },
};


export const FILE_SOURCE: Record<string, string> = {
  "orchestrator.py": `import asyncio, logging, time
from codegraph_agent.domain.models import AgentTask, WorkflowResult
from codegraph_agent.orchestrator.routing_policy import DeepReasoningRoutingPolicy
from codegraph_agent.shared.reasoning import ReasoningDecision, ReflectionVerdict

class DeepReasoningOrchestrator:
    # V8 main execution pipeline (RFC-016)
    async def execute(self, request: DeepReasoningRequest) -> DeepReasoningResponse:
        decision = await self._decide_reasoning_path(request.task)
        strategy = await self._select_strategy(request, decision)
        # ... strategy execution (beam / o1 / debate / alphacode)
        await experience_store.save(result)
        return DeepReasoningResponse(success=True, workflow_result=result)

    # dead — legacy inference bridge removed in v8
    def _legacy_inference_bridge(self): ...`,

  "routing_policy.py": `from dataclasses import dataclass
from codegraph_shared.common.observability import get_logger
from .base import QueryDSLMixin, StepTool, StepToolResult

# ================================================================
# Security Tools (RFC-041)

class AnalyzeControlFlowTool(StepTool):
    # RFC-041: SOTA — Semgrep + Infer hybrid
    def _analyze_taint_path_control_flow(self, target: str) -> StepToolResult:
        cfg = self._build_cfg(target)
        findings = self._run_semgrep_analysis(target, cfg)
        guards = self._identify_security_guards(cfg, findings)
        return StepToolResult(success=True, data=findings, confidence=0.85)

    # dead — legacy Joern bridge removed in RFC-041
    def _joern_cpg_bridge(self): ...`,

  "security.py": `from dataclasses import dataclass
from codegraph_shared.common.observability import get_logger
from .base import QueryDSLMixin, StepTool, StepToolResult

# ================================================================
# Security Tools (RFC-041)

class AnalyzeControlFlowTool(StepTool):
    # RFC-041: SOTA — Semgrep + Infer hybrid
    def _analyze_taint_path_control_flow(self, target: str) -> StepToolResult:
        cfg = self._build_cfg(target)
        findings = self._run_semgrep_analysis(target, cfg)
        guards = self._identify_security_guards(cfg, findings)
        return StepToolResult(success=True, data=findings, confidence=0.85)

    # dead — legacy Joern bridge removed in RFC-041
    def _joern_cpg_bridge(self): ...`,

  "audit_store.py": `import json, sqlite3
from pathlib import Path
from pydantic import BaseModel, Field, field_validator

class AuditEntry(BaseModel):
    event: str
    actor: str
    timestamp: float
    payload: dict = Field(default_factory=dict)

    @field_validator("event")
    def validate_event(cls, v: str) -> str:
        if not v.strip():
            raise ValueError("event must not be empty")
        return v.strip()

def store_request(entry: AuditEntry, db_path: Path) -> None:
    conn = sqlite3.connect(str(db_path))
    conn.execute(
        "INSERT INTO audit (event, actor, ts, payload) VALUES (?, ?, ?, ?)",
        (entry.event, entry.actor, entry.timestamp, json.dumps(entry.payload)),
    )
    conn.commit()
    conn.close()`,
};

/** Per-line metadata for gutter + inline hints. */
export interface LineMeta {
  risk?: 1 | 2 | 3 | 4;
  hints?: string[];   // short inline labels, e.g. "12 callers", "0/12 tests"
  inline?: string;    // right-aligned inline text, e.g. "impact root"
  inlineWarn?: boolean;
}

/** line number (1-based) → metadata */
export const FILE_LINE_META: Record<string, Record<number, LineMeta>> = {
  "orchestrator.py": {
    4:  { hints: ["taint: request.task → experience_store"] },
    6:  { risk: 4, hints: ["cpx 9.1", "0/12 tests", "@songmin · 2w"] },
    8:  { risk: 4, hints: ["12 callers", "no rollback"], inline: "hot path" },
    9:  { risk: 3 },
    10: { risk: 4 },
    12: { risk: 4, hints: ["8 callers", "no transaction"], inline: "taint sink", inlineWarn: true },
    13: { risk: 2, hints: ["38 files blast"] },
    16: { hints: ["stale 5mo", "0 callers"] },
  },
  "routing_policy.py": {
    8:  { risk: 3, hints: ["cpx 6.3", "2/7 tests"] },
    10: { risk: 4, hints: ["7 callers", "taint: target → _run_semgrep"] },
    12: { risk: 4, hints: ["path traversal"], inline: "taint sink", inlineWarn: true },
    14: { risk: 2, hints: ["21 files blast"] },
    17: { hints: ["stale 6mo", "0 callers"] },
  },
  "security.py": {
    8:  { risk: 3, hints: ["cpx 6.3", "2/7 tests"] },
    10: { risk: 4, hints: ["7 callers", "taint: target → _run_semgrep"] },
    12: { risk: 4, hints: ["path traversal"], inline: "taint sink", inlineWarn: true },
    14: { risk: 2, hints: ["21 files blast"] },
    17: { hints: ["stale 6mo", "0 callers"] },
  },
  "audit_store.py": {
    19: { risk: 2, hints: ["5 callers"] },
  },
};

/**
 * Map of function/symbol names to their impact data.
 * When a user edits a line containing one of these symbols,
 * we trigger the corresponding impact.
 */
export interface SymbolImpactMapping {
  symbol: string;
  /** regex pattern to match the line */
  linePattern: RegExp;
  originFn: string;
  riskScore: number;
  files: number;
  functions: number;
  apis: number;
  tests: number;
  confidence: number;
  summary: string;
}

export const SYMBOL_IMPACTS: SymbolImpactMapping[] = [
  {
    symbol: "execute",
    linePattern: /def execute/,
    originFn: "execute",
    riskScore: 78,
    files: 38,
    functions: 24,
    apis: 5,
    tests: 12,
    confidence: 0.92,
    summary: "Changing execute() affects 38 downstream files including experience_store, routing_policy, and 5 API endpoints.",
  },
  {
    symbol: "experience_store.save",
    linePattern: /experience_store\.save/,
    originFn: "experience_store.save",
    riskScore: 65,
    files: 14,
    functions: 8,
    apis: 3,
    tests: 11,
    confidence: 0.91,
    summary: "Changing this line affects session validation, request auth middleware, and 3 API response paths.",
  },
  {
    symbol: "_decide_reasoning_path",
    linePattern: /_decide_reasoning_path/,
    originFn: "_decide_reasoning_path",
    riskScore: 52,
    files: 21,
    functions: 14,
    apis: 2,
    tests: 7,
    confidence: 0.88,
    summary: "Routing decision change propagates through strategy selection, affecting 21 files and 2 API paths.",
  },
  {
    symbol: "_select_strategy",
    linePattern: /_select_strategy/,
    originFn: "_select_strategy",
    riskScore: 44,
    files: 16,
    functions: 11,
    apis: 1,
    tests: 9,
    confidence: 0.85,
    summary: "Strategy selection change affects beam/o1/debate execution paths across 16 files.",
  },
  {
    symbol: "_analyze_taint_path_control_flow",
    linePattern: /_analyze_taint_path_control_flow/,
    originFn: "_analyze_taint_path_control_flow",
    riskScore: 52,
    files: 21,
    functions: 14,
    apis: 2,
    tests: 7,
    confidence: 0.88,
    summary: "Taint analysis function change affects security tools, semgrep runner, and CFG builder across 21 files.",
  },
  {
    symbol: "_run_semgrep_analysis",
    linePattern: /_run_semgrep_analysis/,
    originFn: "_run_semgrep_analysis",
    riskScore: 58,
    files: 12,
    functions: 6,
    apis: 1,
    tests: 4,
    confidence: 0.90,
    summary: "Semgrep analysis sink — target path flows here without normalization. 12 dependent files.",
  },
  {
    symbol: "store_request",
    linePattern: /def store_request/,
    originFn: "store_request",
    riskScore: 23,
    files: 8,
    functions: 5,
    apis: 1,
    tests: 5,
    confidence: 0.95,
    summary: "Audit store write path. 8 files depend on this function for event logging.",
  },
];
