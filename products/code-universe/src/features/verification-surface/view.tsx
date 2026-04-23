// VerificationSurface view descriptor — AI-verifiability of a file.
// --------------------------------------------------------------------
// Reference: Yang et al. "SWE-agent: Agent-Computer Interfaces Enable
// Automated Software Engineering" 2024 (verification loop); Chen et al.
// "AgentVerify: Verification Strategies for LLM Agents" 2024. Asks the
// question: "can an agent RUN TESTS to check its own work on this
// file?" — composite of assertion density × covered-symbol ratio.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { VerificationSurfaceView } from "./ui/VerificationSurfaceView";

function VerificationSurfaceModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <VerificationSurfaceView ctx={ctx} empty />;
  }
  return <VerificationSurfaceView ctx={ctx} entity={entity} />;
}

export const verificationSurfaceViewDescriptor: ViewDescriptor = {
  id: "verification-surface",
  label: "Verify",
  glyph: "◉",
  hint: "AI 검증 표면 — 테스트 × 심볼 밀도",
  tech: "assertion/symbol 비율 × 커버 심볼 %",
  usecase: "에이전트가 자기 변경을 스스로 검증할 수 있는가. Self-correction 가능 여부 판단.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 810,
  capabilityKinds: ["view", "decision-input", "workflow-step", "gate-check"],
  taxonomy: {
    primary: {
      domain: "ai-trust-governance",
      scope: "file",
      intent: "verify",
    },
    scopes: ["file", "diff", "task"],
    intents: ["verify", "decide"],
    subdomain: "self-verification",
    personas: ["reviewer", "developer", "tech-lead"],
    surfaces: ["view", "tab", "diff-inline"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "gating",
    },
    related: ["diff-evidence", "message-code-mismatch", "spec-gaming"],
    keywords: ["verification", "tests", "assertions", "surface", "coverage"],
  },
  decision: {
    grade: "gating",
    supports: ["merge", "delegate"],
    evidenceClass: "strong",
    failClosedEligible: true,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-pr-review", "attach-to-admission-gate", "attach-to-agent-plan"],
  workflow: {
    usableInStacks: ["ai-review-stack", "agent-delegation-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: true,
  },
  quality: {
    maturity: "core",
    owner: "ai-platform",
  },
  Component: VerificationSurfaceModeView,
};
