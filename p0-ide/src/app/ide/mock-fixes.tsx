import type { ReactNode } from "react";
import type { ChangeProposal } from "@/features/ide-change-card";
import type { FileName } from "./model/useActiveFile";

export interface FixContent {
  titleKey: string;
  code: ReactNode;
  meta: { kKey: string; v: string }[];
  proposal: ChangeProposal;
}

const ORCHESTRATOR_FIX: FixContent = {
  titleKey: "ide.fixes.refund.title",
  code: (
    <>
      <span>{"  result = await self._execute_strategy(request, strategy)\n"}</span>
      <span className="add">{"+ validated = self._validate_result_metadata(result)\n"}</span>
      <span className="del">{"- await experience_store.save(result)\n"}</span>
      <span className="add">{"+ await experience_store.save(validated)"}</span>
    </>
  ),
  meta: [
    { kKey: "behavior", v: "equivalent" },
    { kKey: "risk", v: "−1 taint path" },
    { kKey: "confidence", v: "high" },
    { kKey: "tests", v: "+3" },
  ],
  proposal: {
    id: "agent-orchestrator-001",
    source: "agent",
    title: "Validate result metadata before experience_store.save",
    summary:
      "Adds _validate_result_metadata() between strategy execution and experience_store.save() to break the taint path from request.task through to the PostgreSQL ExperienceRepository.",
    diff: [
      { line: 11, type: "ctx", text: "        result = await self._execute_strategy(request, strategy)" },
      { line: 12, type: "add", text: "        validated = self._validate_result_metadata(result)" },
      { line: 13, type: "del", text: "        await experience_store.save(result)" },
      { line: 13, type: "add", text: "        await experience_store.save(validated)" },
    ],
    impact: { blastBefore: 38, blastAfter: 38, testsAtRisk: 0, testsBroken: 0, taintDelta: -1 },
    behavior: [
      { change: "invalid strategy string → ValidationError (was: silently written)", intentional: true },
      { change: "valid inputs: identical", intentional: true },
    ],
    risk: "low",
    confidence: "high",
    evidence: [
      { label: "Taint path resolved", loc: "orchestrator.py:8 → orchestrator.py:12" },
      { label: "_validate_result_metadata can be added inline", loc: "orchestrator.py:315" },
      { label: "ExperienceRepository schema has strategy column", loc: "infrastructure/experience/repo.py:44" },
    ],
    verification: { behavior: "equivalent", sideEffects: "equivalent", tests: "passing" },
  },
};

const SECURITY_FIX: FixContent = {
  titleKey: "ide.fixes.charge.title",
  code: (
    <>
      <span>{"  def _analyze_taint_path_control_flow(\n"}</span>
      <span>{"      self, target: str\n"}</span>
      <span className="add">{"+ ) -> StepToolResult:\n"}</span>
      <span className="add">{"+ target = os.path.normpath(os.path.abspath(target))\n"}</span>
      <span className="add">{"+ if not target.startswith(ALLOWED_ROOT):\n"}</span>
      <span className="add">{"+ raise ValueError(f\"target outside allowed root\")"}</span>
    </>
  ),
  meta: [
    { kKey: "behavior", v: "equivalent" },
    { kKey: "risk", v: "−1 path traversal" },
    { kKey: "confidence", v: "high" },
    { kKey: "tests", v: "+2" },
  ],
  proposal: {
    id: "agent-security-001",
    source: "agent",
    title: "Normalize + allowlist-check target before semgrep",
    summary:
      "target is passed directly to the semgrep subprocess without path normalization, enabling path traversal. Adding normpath + abspath + allowlist check before the call closes the vulnerability.",
    diff: [
      { line: 10, type: "ctx", text: "    def _analyze_taint_path_control_flow(self, target: str) -> StepToolResult:" },
      { line: 11, type: "add", text: "        target = os.path.normpath(os.path.abspath(target))" },
      { line: 12, type: "add", text: "        if not target.startswith(ALLOWED_ROOT):" },
      { line: 13, type: "add", text: "            raise ValueError(f\"target outside allowed root: {target}\")" },
      { line: 14, type: "ctx", text: "        cfg = self._build_cfg(target)" },
    ],
    impact: { blastBefore: 21, blastAfter: 21, testsAtRisk: 0, testsBroken: 0, taintDelta: -1 },
    behavior: [
      { change: "relative paths: normalized to absolute (was: passed raw)", intentional: true },
      { change: "paths outside ALLOWED_ROOT: ValueError (was: executed)", intentional: true },
    ],
    risk: "low",
    confidence: "high",
    evidence: [
      { label: "Path traversal vector confirmed", loc: "security.py:12" },
      { label: "ALLOWED_ROOT already defined in config", loc: "shared/config.py:18" },
      { label: "semgrep accepts absolute paths", loc: "semgrep docs" },
    ],
    verification: { behavior: "equivalent", sideEffects: "equivalent", tests: "passing" },
  },
};

const AUDIT_FIX: FixContent = {
  titleKey: "ide.fixes.ledger.title",
  code: (
    <>
      <span>{"    # dead — legacy Joern bridge removed in RFC-041\n"}</span>
      <span className="del">{"- def _joern_cpg_bridge(self): ..."}</span>
    </>
  ),
  meta: [
    { kKey: "behavior", v: "equivalent" },
    { kKey: "risk", v: "0" },
    { kKey: "confidence", v: "high" },
    { kKey: "loc", v: "−31" },
  ],
  proposal: {
    id: "agent-security-002",
    source: "agent",
    title: "Remove dead _joern_cpg_bridge",
    summary:
      "_joern_cpg_bridge has zero callers since the Joern → semgrep migration in RFC-041 six months ago. Removing it eliminates 31 LOC of dead code.",
    diff: [
      { line: 16, type: "del", text: "    # dead — legacy Joern bridge removed in RFC-041" },
      { line: 17, type: "del", text: "    def _joern_cpg_bridge(self): ..." },
    ],
    impact: { blastBefore: 8, blastAfter: 8, testsAtRisk: 0, testsBroken: 0, taintDelta: 0 },
    behavior: [{ change: "no callers — runtime unchanged", intentional: true }],
    risk: "low",
    confidence: "high",
    evidence: [
      { label: "Zero callers", loc: "find references" },
      { label: "RFC-041 removed Joern dependency", loc: "docs/rfcs/041-security-tools.md" },
      { label: "No string references", loc: "grep -r _joern_cpg_bridge" },
    ],
    verification: { behavior: "equivalent", sideEffects: "equivalent", tests: "passing" },
  },
};

export const FILE_FIXES: Record<FileName, FixContent> = {
  "orchestrator.py": ORCHESTRATOR_FIX,
  "routing_policy.py": SECURITY_FIX,
  "security.py": SECURITY_FIX,
  "audit_store.py": AUDIT_FIX,
};
