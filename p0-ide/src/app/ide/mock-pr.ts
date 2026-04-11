import type { FileName } from "./model/useActiveFile";

export interface PrImpactRow {
  label: string;
  before: string;
  after: string;
  delta: string;
  resolved?: boolean;
}

export interface PrFile {
  stat: string;
  path: string;
}

export interface PrBehaviorRow {
  ok: boolean;
  text: string;
  detail?: string;
}

export interface PrHistoryRow {
  tag: string;
  text: string;
}

export interface PrDraft {
  branch: string;
  title: string;
  summary: string;
  highlightSymbol: string;
  funcName: string;
  impact: PrImpactRow[];
  reviewerGuide: { ref: string; reason: string; confidence: string };
  behavior: PrBehaviorRow[];
  history: PrHistoryRow[];
  files: PrFile[];
}

export const FILE_PR: Record<FileName, PrDraft> = {
  "orchestrator.py": {
    branch: "fix/orchestrator-taint-validation → main",
    title: "orchestrator: validate metadata before experience_store.save",
    summary:
      "Adds _validate_result_metadata() in execute() to break the request.task → experience_store.save taint path. Invalid strategy strings now raise ValidationError instead of being silently persisted to PostgreSQL.",
    highlightSymbol: "experience_store.save",
    funcName: "execute()",
    impact: [
      { label: "Complexity", before: "9.1", after: "5.2", delta: "−43%" },
      { label: "Blast radius", before: "38", after: "22 files", delta: "−42%" },
      { label: "Taint paths", before: "2", after: "0", delta: "resolved", resolved: true },
      { label: "Test coverage", before: "0%", after: "68%", delta: "+3 new tests", resolved: true },
    ],
    reviewerGuide: {
      ref: "infrastructure/experience/repo.py:44",
      reason: "_validate_result_metadata must accept all strategy enum values — verify against StrategyType",
      confidence: "high",
    },
    behavior: [
      { ok: true, text: "Valid strategy: identical" },
      { ok: false, text: "Unknown strategy string: was silent write, now ValidationError", detail: "intentional" },
    ],
    history: [
      { tag: "incident", text: "INC-2025-0218 — corrupt experience rows from unknown strategy" },
      { tag: "resolves", text: "this PR validates strategy before persistence" },
    ],
    files: [
      { stat: "+18 −2", path: "codegraph_agent/orchestrator/orchestrator.py" },
      { stat: "+24 −0", path: "tests/orchestrator/test_execute.py" },
      { stat: "+6 −0",  path: "codegraph_agent/orchestrator/validators.py" },
    ],
  },
  "security.py": {
    branch: "fix/security-path-traversal → main",
    title: "security: normalize + allowlist target before semgrep",
    summary:
      "target in _analyze_taint_path_control_flow() is passed raw to the semgrep subprocess, enabling path traversal. This PR adds os.path.normpath + abspath + ALLOWED_ROOT check before the call.",
    highlightSymbol: "_run_semgrep_analysis",
    funcName: "_analyze_taint_path_control_flow()",
    impact: [
      { label: "Complexity", before: "6.3", after: "6.3", delta: "0" },
      { label: "Blast radius", before: "21", after: "21 files", delta: "0" },
      { label: "Path traversal", before: "unsafe", after: "allowlisted", delta: "fixed", resolved: true },
      { label: "Test coverage", before: "29%", after: "57%", delta: "+2 tests", resolved: true },
    ],
    reviewerGuide: {
      ref: "shared/config.py:18",
      reason: "verify ALLOWED_ROOT is set correctly in all environments (dev/staging/prod)",
      confidence: "high",
    },
    behavior: [
      { ok: true, text: "Valid path within ALLOWED_ROOT: identical" },
      { ok: true, text: "Relative paths: normalized to absolute before semgrep" },
      { ok: false, text: "Path outside ALLOWED_ROOT: ValueError (was: executed)", detail: "intentional" },
    ],
    history: [
      { tag: "audit", text: "SEC-2025-0114 — path traversal in tool dispatcher" },
      { tag: "resolves", text: "this PR closes the traversal vector" },
    ],
    files: [
      { stat: "+12 −1", path: "codegraph_agent/tools/plan_orchestration/tools/security.py" },
      { stat: "+16 −0", path: "tests/tools/test_analyze_control_flow.py" },
    ],
  },
  "routing_policy.py": {
    branch: "fix/routing-policy-validation → main",
    title: "routing_policy: add request validation before dispatch",
    summary: "Adds input validation in _route_request() to prevent unvalidated payloads from reaching downstream handlers.",
    highlightSymbol: "_route_request",
    funcName: "_route_request()",
    impact: [
      { label: "Complexity", before: "5.1", after: "3.8", delta: "−26%" },
      { label: "Taint paths", before: "1", after: "0", delta: "resolved", resolved: true },
      { label: "Test coverage", before: "11%", after: "55%", delta: "+2 new tests", resolved: true },
    ],
    reviewerGuide: {
      ref: "routing_policy.py:88",
      reason: "verify all callers pass validated payloads",
      confidence: "medium",
    },
    behavior: [
      { ok: true, text: "Runtime: unchanged" },
      { ok: true, text: "Invalid payloads now raise ValidationError" },
    ],
    history: [
      { tag: "fix", text: "routing validation gap found in audit" },
    ],
    files: [
      { stat: "+8 −2", path: "codegraph_agent/orchestrator/routing_policy.py" },
    ],
  },
  "audit_store.py": {
    branch: "chore/remove-joern-bridge → main",
    title: "security: remove dead _joern_cpg_bridge",
    summary:
      "_joern_cpg_bridge has zero callers since the Joern → semgrep migration in RFC-041 six months ago. Removing it eliminates 31 LOC of dead code and the unused joern-python dependency.",
    highlightSymbol: "_joern_cpg_bridge",
    funcName: "store_request()",
    impact: [
      { label: "Complexity", before: "6.3", after: "6.3", delta: "0" },
      { label: "LOC",         before: "477", after: "446", delta: "−31", resolved: true },
      { label: "Dead funcs",  before: "1",   after: "0",   delta: "removed", resolved: true },
      { label: "Dependencies", before: "joern-python", after: "removed", delta: "−1 dep", resolved: true },
    ],
    reviewerGuide: {
      ref: "security.py:198",
      reason: "grep for _joern_cpg_bridge in any external plugin — confirm no dynamic callers",
      confidence: "high",
    },
    behavior: [
      { ok: true, text: "Runtime: unchanged" },
      { ok: true, text: "Build: −31 LOC, joern-python dep removed" },
    ],
    history: [
      { tag: "migration", text: "RFC-041 replaced Joern with semgrep 6mo ago" },
      { tag: "cleanup", text: "this PR finishes the migration" },
    ],
    files: [
      { stat: "+0 −31", path: "codegraph_agent/tools/plan_orchestration/tools/security.py" },
    ],
  },
};
