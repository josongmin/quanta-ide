// TokenEconomy view descriptor — repo-level LLM token economy.
// --------------------------------------------------------------------
// Reference: OpenAI tiktoken; Anthropic Claude tokenizer; 2026 model
// pricing sheets. Measures the codebase as an economic object for AI
// agents: how many tokens, how much per task, what's the AI-friendly
// share. Novel 2026 contribution — "token economics as a first-class
// software metric".

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { TokenEconomyView } from "./ui/TokenEconomyView";

function TokenEconomyModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <TokenEconomyView ctx={ctx} />;
}

export const tokenEconomyViewDescriptor: ViewDescriptor = {
  id: "token-economy",
  label: "Economy",
  glyph: "✦",
  hint: "LLM 토큰 경제 — repo 전체 비용",
  tech: "tiktoken/claude 기반 추정 × 2026 모델 가격",
  usecase: "AI 에이전트 월 비용 예측. 가장 비싼 파일 감사. '이 repo를 AI가 돌리려면 얼마?' 답.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 700,
  capabilityKinds: ["view", "decision-input", "policy-control"],
  taxonomy: {
    primary: {
      domain: "ai-context-model",
      scope: "budget",
      intent: "govern",
    },
    scopes: ["repo", "budget", "model"],
    intents: ["optimize", "decide", "govern"],
    subdomain: "token-economics",
    personas: ["developer", "manager", "ai-operator"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "auditable",
      decisionGrade: "advisory",
    },
    related: ["cache-roi", "budget-console", "model-router"],
    keywords: ["token", "economy", "cost", "budget", "pricing"],
  },
  decision: {
    grade: "advisory",
    supports: ["route-model", "policy-audit"],
    evidenceClass: "auditable",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "pin-dashboard", "attach-to-policy-check"],
  workflow: {
    usableInStacks: ["context-engineering-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "core",
    owner: "ai-platform",
  },
  Component: TokenEconomyModeView,
};
