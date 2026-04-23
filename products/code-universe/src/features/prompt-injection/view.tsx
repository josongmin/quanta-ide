// PromptInjection view descriptor — OWASP LLM01 surface map.
// --------------------------------------------------------------------
// Reference: OWASP LLM01:2025 Prompt Injection; Simon Willison's
// ongoing "Prompt injection" taxonomy (2023+); Greshake et al. "Not
// What You've Signed Up For: Compromising Real-World LLM-Integrated
// Applications with Indirect Prompt Injection" 2023. Scans for flows
// where untrusted data reaches LLM sinks.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { PromptInjectionView } from "./ui/PromptInjectionView";

function PromptInjectionModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <PromptInjectionView ctx={ctx} />;
}

export const promptInjectionViewDescriptor: ViewDescriptor = {
  id: "prompt-injection",
  label: "Injection",
  glyph: "⚠",
  hint: "프롬프트 주입 공격면",
  tech: "untrusted source → LLM sink data-flow",
  usecase:
    "2025 OWASP Top 1 LLM vuln. 보안 감사 필수.",
  category: "ai",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 880,
  capabilityKinds: ["view", "decision-input", "gate-check", "policy-control"],
  taxonomy: {
    primary: {
      domain: "ai-trust-governance",
      scope: "policy",
      intent: "verify",
    },
    scopes: ["repo", "file", "diff", "policy"],
    intents: ["verify", "govern", "decide"],
    subdomain: "prompt-security",
    personas: ["security", "reviewer", "ai-operator"],
    surfaces: ["view", "tab", "diff-inline"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "auditable",
      decisionGrade: "blocking",
    },
    related: ["red-team", "audit-trail", "blast-radius-agent"],
    keywords: ["prompt", "injection", "owasp", "security", "firewall"],
  },
  decision: {
    grade: "blocking",
    supports: ["merge", "policy-audit", "delegate"],
    evidenceClass: "auditable",
    failClosedEligible: true,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "attach-to-admission-gate", "attach-to-policy-check", "attach-to-pr-review"],
  workflow: {
    usableInStacks: ["ai-review-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: true,
  },
  quality: {
    maturity: "core",
    owner: "security",
  },
  Component: PromptInjectionModeView,
};
