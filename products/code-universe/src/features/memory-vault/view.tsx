// MemoryVault view descriptor.
// --------------------------------------------------------------------
// Persistent facts the agent remembers about this repo.
// Kind filter × fact cards with confidence / source / usage.
//
// Reference: LangMem / Letta (MemGPT) persistent memory; Claude
// Projects knowledge; Anthropic "Creating effective Claude Projects"
// (2024).

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { MemoryVaultView } from "./ui/MemoryVaultView";

function MemoryVaultModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <MemoryVaultView ctx={ctx} />;
}

export const memoryVaultViewDescriptor: ViewDescriptor = {
  id: "memory-vault",
  label: "Memory",
  glyph: "▥",
  hint: "에이전트 메모리 금고",
  tech: "team-curated + agent-inferred facts × confidence × verification",
  usecase: "에이전트가 이 repo만의 규약/함정을 기억. 매 세션 재설명 불필요.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 970,
  capabilityKinds: ["view", "decision-input", "workflow-step", "policy-control"],
  taxonomy: {
    primary: {
      domain: "ai-context-model",
      scope: "task",
      intent: "explain",
    },
    scopes: ["repo", "task", "policy", "file"],
    intents: ["explain", "govern", "decide"],
    subdomain: "agent-memory",
    personas: ["developer", "ai-operator", "manager"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "triage",
      cost: "medium",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    related: ["context-curator", "skill-library", "audit-trail"],
    keywords: ["memory", "vault", "facts", "verified", "confidence"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate", "policy-audit"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-agent-plan", "attach-to-policy-check"],
  workflow: {
    usableInStacks: ["context-engineering-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: MemoryVaultModeView,
};
