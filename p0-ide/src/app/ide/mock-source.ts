/** Plain-text Python sources for the editable editor. */
import orchestratorSrc from "@corpus/codegraph_agent/orchestrator/orchestrator.py?raw";
import routingPolicySrc from "@corpus/codegraph_agent/orchestrator/routing_policy.py?raw";
import securitySrc from "@corpus/codegraph_agent/tools/plan_orchestration/security.py?raw";
import auditStoreSrc from "@corpus/infrastructure/audit_store.py?raw";
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

  "OldRetryPolicy": {
    name: "OldRetryPolicy", kind: "class", fieldCount: 0, callers: 0,
    detail: "DEAD: Replaced by RetryScheduler in PR #312 (2024-11-03). Zero callers.",
    tags: ["dead"],
  },
  "TEMP_FEATURE_FLAG": {
    name: "TEMP_FEATURE_FLAG", kind: "const",
    detail: "DEAD: Permanently enabled boolean. Gate condition always passes. Safe to remove.",
    tags: ["dead"],
  },
  "_run_strategy": {
    name: "_run_strategy", kind: "function", complexity: 2.0, callers: 1,
    detail: "Dispatches to strategy runner by name. Silent fallback to beam on unknown strategy — no error raised.",
  },
  "_run_beam_strategy": {
    name: "_run_beam_strategy", kind: "function", complexity: 1.0, callers: 1,
    detail: "Beam search strategy runner. Default fallback. 1 caller.",
  },

  // ── routing_policy.py ──
  "DeepReasoningRoutingPolicy": {
    name: "DeepReasoningRoutingPolicy", kind: "class", methodCount: 5, fieldCount: 2,
    churn: 14, churnRisk: "mid", coupledFiles: ["orchestrator.py"],
    detail: "Routes reasoning requests to backends. estimate_confidence cached per task type.",
  },
  "estimate_confidence": {
    name: "estimate_confidence", kind: "function", complexity: 3.0, callers: 2,
    detail: "Heuristic confidence scoring. Cached per task type. Tested (1/1).",
  },
  "route_request": {
    name: "route_request", kind: "function", complexity: 4.5, callers: 7,
    taint: "passthrough",
    detail: "Route to best backend. 7 callers — taint passthrough from task.target. UNCOVERED.",
    tags: ["no-tests"],
  },
  "_select_backend": {
    name: "_select_backend", kind: "function", complexity: 2.0, callers: 1,
    detail: "Maps task_type to backend name. Returns None if no match. UNCOVERED.",
    tags: ["no-tests"],
  },
  "_old_route_v1": {
    name: "_old_route_v1", kind: "function", callers: 0,
    detail: "DEAD: V1 routing logic. Replaced by route_request() in RFC-016.",
    tags: ["dead"],
  },
  "formatLegacyResponse": {
    name: "formatLegacyResponse", kind: "function", callers: 0,
    detail: "DEAD: Only called from deprecated /v1/route endpoint (removed).",
    tags: ["dead", "stale"],
  },

  // ── security.py ──
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
  "DebugTaintFlow": {
    name: "DebugTaintFlow", kind: "class", fieldCount: 0, callers: 0,
    detail: "DEAD: Debug-only class. No production import path. print() calls only.",
    tags: ["dead"],
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

  // ── infrastructure/fee.py ──
  "calculateFee": {
    name: "calculateFee", kind: "function", complexity: 3.0, callers: 12, riskScore: 78,
    taint: "passthrough",
    churn: 22, churnRisk: "high", coupledFiles: ["orchestrator.py", "billing.py"],
    blame: { author: "@songmin", when: "3d ago" },
    detail: "Fee calculator. amount is user-controlled — no bounds check. Negative amounts produce negative fees. 12 callers, 0 tests.",
    tags: ["no-tests", "hot-path", "high-churn"],
  },
  "validateFeeRule": {
    name: "validateFeeRule", kind: "function", complexity: 2.5, callers: 2,
    detail: "Validates fee rule constraints (rate range, amount bounds). UNCOVERED — 0 tests.",
    tags: ["no-tests"],
  },
  "applyDiscount": {
    name: "applyDiscount", kind: "function", complexity: 1.0, callers: 3,
    detail: "Applies percentage discount. No bounds check on discount_pct — can go negative. UNCOVERED.",
    tags: ["no-tests"],
  },
  "FeeRule": {
    name: "FeeRule", kind: "class", fieldCount: 5,
    detail: "Fee rule dataclass: rule_id, rate, min_amount, max_amount, active.",
  },
  "FeeConfig": {
    name: "FeeConfig", kind: "class", fieldCount: 3,
    detail: "Fee configuration. Co-changes with calculateFee. risk 2.",
  },

  // ── infrastructure/webhook.py ──
  "dispatchWebhook": {
    name: "dispatchWebhook", kind: "function", complexity: 4.0, callers: 8, riskScore: 72,
    taint: "sink",
    churn: 18, churnRisk: "mid", coupledFiles: ["orchestrator.py", "fee.py"],
    blame: { author: "@dana", when: "1w ago" },
    detail: "Webhook dispatch — taint sink. payload contains unsanitized user data (amount, reason). No sanitizeAmount() before serialization.",
    tags: ["no-tests", "write"],
  },
  "verifySignature": {
    name: "verifySignature", kind: "function", complexity: 2.0, callers: 4,
    detail: "HMAC-SHA256 webhook signature verification. UNCOVERED — 0 tests. Crypto-critical.",
    tags: ["no-tests"],
  },
  "retryDelivery": {
    name: "retryDelivery", kind: "function", complexity: 1.5, callers: 0,
    detail: "Retry failed webhook. Called from deprecated endpoint — effectively dead.",
    tags: ["dead"],
  },
  "WebhookConfig": {
    name: "WebhookConfig", kind: "class", fieldCount: 4,
    detail: "Webhook endpoint config: endpoint, secret, timeout_s, max_retries.",
  },

  // ── infrastructure/retry.py ──
  "RetryScheduler": {
    name: "RetryScheduler", kind: "class", methodCount: 3, fieldCount: 2,
    churn: 15, churnRisk: "mid", coupledFiles: ["orchestrator.py"],
    detail: "Configurable async retry with exponential backoff. 3 callers. Coupled with orchestrator retry loop.",
    tags: ["hot-path"],
  },
  "backoff": {
    name: "backoff", kind: "function", complexity: 1.0, callers: 0,
    detail: "Standalone backoff helper. UNCOVERED — 0 tests. Not currently called (RetryScheduler._compute_delay used instead).",
    tags: ["no-tests"],
  },
  "MAX_RETRIES": {
    name: "MAX_RETRIES", kind: "variable", callers: 0,
    detail: "DEAD: Constant replaced by config-driven retry_count in orchestrator.",
    tags: ["dead"],
  },
  "RetryConfig": {
    name: "RetryConfig", kind: "class", fieldCount: 4,
    detail: "Retry configuration: max_attempts, base_delay_s, max_delay_s, exponential.",
  },

  // ── infrastructure/ledger.py ──
  "LedgerService": {
    name: "LedgerService", kind: "class", methodCount: 4, fieldCount: 2,
    churn: 12, churnRisk: "mid", coupledFiles: ["fee.py", "orchestrator.py"],
    detail: "Financial ledger. postEntry has 8 callers across 3 services. Not wrapped in transaction.",
  },
  "postEntry": {
    name: "postEntry", kind: "function", complexity: 2.0, callers: 8, riskScore: 55,
    blame: { author: "@erin", when: "2w ago" },
    detail: "Posts ledger entry. risk 3 — DB write, 8 callers. Not wrapped in transaction — partial writes possible.",
    tags: ["no-tests"],
  },
  "reconcile": {
    name: "reconcile", kind: "function", complexity: 4.0, callers: 3,
    detail: "Reconciles all entries for a transaction. Complex sum logic. UNCOVERED.",
    tags: ["no-tests"],
  },
  "rollbackEntry": {
    name: "rollbackEntry", kind: "function", complexity: 1.5, callers: 1,
    detail: "Rolls back a specific ledger entry. UNCOVERED.",
    tags: ["no-tests"],
  },
  "LedgerEntry": {
    name: "LedgerEntry", kind: "class", fieldCount: 6,
    detail: "Ledger entry dataclass: entry_id, transaction_id, amount, entry_type, timestamp, metadata.",
  },

  // ── infrastructure/billing.py ──
  "BillingService": {
    name: "BillingService", kind: "class", methodCount: 2, fieldCount: 2,
    detail: "Billing cycle management. chargeCycle is hot path via orchestrator → fee → billing.",
  },
  "chargeCycle": {
    name: "chargeCycle", kind: "function", complexity: 3.0, callers: 2, riskScore: 48,
    churn: 9, churnRisk: "low",
    detail: "Billing charge cycle. risk 3 — hot path. UNCOVERED. Transitive: orchestrator → fee → billing → ledger.",
    tags: ["no-tests", "hot-path"],
  },
  "BillingPlan": {
    name: "BillingPlan", kind: "class", fieldCount: 4,
    detail: "Billing plan: plan_id, name, base_rate, cycle_days.",
  },

  // ── domain/models.py (AgentTask, WorkflowResult already defined above) ──
  "RefundRequest": {
    name: "RefundRequest", kind: "class", fieldCount: 5,
    detail: "Refund domain object. amount is user-controlled — taint source. idempotency_key often None.",
    tags: ["taint-source"],
  },
  "FeeCalculation": {
    name: "FeeCalculation", kind: "class", fieldCount: 5,
    detail: "Fee calculation result: base_amount, fee_rate, fee_amount, total, rule_id.",
  },

  // ── shared/reasoning.py ──
  "ReasoningDecision": {
    name: "ReasoningDecision", kind: "class", fieldCount: 2,
    detail: "Reasoning path decision: SYSTEM_1_FAST or SYSTEM_2_DEEP with confidence score.",
  },
  "ReflectionVerdict": {
    name: "ReflectionVerdict", kind: "class", fieldCount: 3,
    detail: "Reflection verdict: should_retry, reason, confidence.",
  },
};


export const FILE_SOURCE: Record<string, string> = {
  "orchestrator.py": orchestratorSrc,
  "routing_policy.py": routingPolicySrc,
  "security.py": securitySrc,
  "audit_store.py": auditStoreSrc,
};

/** Per-line metadata for gutter + inline hints. */
export interface LineMeta {
  risk?: 1 | 2 | 3 | 4;
  hints?: string[];   // short inline labels, e.g. "12 callers", "0/12 tests"
  inline?: string;    // right-aligned inline text, e.g. "impact root"
  inlineWarn?: boolean;
  /** Dead code — dims the line + strikethrough */
  dead?: boolean;
  /** Uncovered by tests — red gutter marker */
  uncovered?: boolean;
  /** Churn intensity 0-1 for heatmap gutter */
  churn?: number;
}

/** line number (1-based) → metadata */
export const FILE_LINE_META: Record<string, Record<number, LineMeta>> = {
  "orchestrator.py": {
    // L28: DeepReasoningRequest — taint source
    28: { hints: ["taint source: request.strategy unchecked"] },
    // L53: __init__ — sets up experience_store (taint sink target)
    53: { churn: 0.5 },
    // L64: execute() — hot path, 12 callers, 0 tests
    64: { risk: 4, hints: ["cpx 9.1", "0/12 tests", "@songmin · 2w"], uncovered: true, churn: 0.9 },
    // L71-80: retry loop without idempotency — BUG
    71: { risk: 4, hints: ["BUG: retry without idempotency"], inline: "hot path", uncovered: true, churn: 1.0 },
    73: { risk: 4, uncovered: true, churn: 0.9 },
    80: { risk: 4, hints: ["no dedup key"], inline: "idempotency gap", inlineWarn: true, churn: 0.8 },
    // L86: experience_store.save() — taint sink
    86: { risk: 4, hints: ["8 callers", "no transaction"], inline: "taint sink", inlineWarn: true, uncovered: true, churn: 0.7 },
    // L98: _decide_reasoning_path
    98: { risk: 3, hints: ["low-conf fallback unlogged"], uncovered: true, churn: 0.6 },
    // L108: _select_strategy — taint passthrough
    108: { risk: 3, hints: ["taint: passthrough"], uncovered: true, churn: 0.5 },
    // L132: _run_beam_strategy
    132: { risk: 2, hints: ["38 files blast"], churn: 0.4 },
    // L147-159: dead code block
    147: { dead: true, hints: ["0 callers", "removed in v8"] },
    148: { dead: true },
    149: { dead: true },
    153: { dead: true, hints: ["replaced by RetryScheduler PR #312"] },
    154: { dead: true },
    155: { dead: true },
    156: { dead: true },
    159: { dead: true, hints: ["always true, gate never fails"] },
  },
  "routing_policy.py": {
    34: { risk: 2, hints: ["cached per task type"] },
    52: { risk: 3, hints: ["7 callers", "taint passthrough"], uncovered: true, churn: 0.5 },
    53: { risk: 3, uncovered: true },
    70: { risk: 2, hints: ["14 files blast"], churn: 0.3 },
    81: { dead: true, hints: ["V1 removed PR #298"] },
    82: { dead: true },
    83: { dead: true },
    86: { dead: true, hints: ["deprecated /v1/route endpoint removed"] },
    87: { dead: true },
    88: { dead: true },
  },
  "security.py": {
    42: { risk: 4, hints: ["cpx 6.3", "2/7 tests"], uncovered: true, churn: 0.8 },
    47: { risk: 4, hints: ["taint: target → CLI"], inline: "taint passthrough", inlineWarn: true },
    64: { risk: 4, hints: ["subprocess.run shell=True"], inline: "taint sink", inlineWarn: true, uncovered: true },
    65: { risk: 4 },
    68: { risk: 3, hints: ["path traversal: target not validated"] },
    79: { risk: 2, hints: ["21 files blast"], churn: 0.3 },
    84: { dead: true, hints: ["debug-only, no production import"] },
    85: { dead: true },
    86: { dead: true },
  },
  "audit_store.py": {
    22: { hints: ["compliance: PII 'email' in payload unmasked"], inline: "DATA-007", inlineWarn: true },
    34: { risk: 2, hints: ["5 callers", "5/5 tests"] },
    39: { risk: 1 },
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
