// SkillLibrary view descriptor — reusable agent skill catalog.
// --------------------------------------------------------------------
// Reference:
//   - Wang et al. "Voyager" (NeurIPS 2023) — lifelong skill library
//   - AutoGen skills (Microsoft 2023)
//   - OpenAI Function Calling patterns (2023-2025)
//   - SkillLLM (2024) — skill composition as a graph
//
// Catalog of reusable agent skills with inputs / outputs / cost /
// success-rate / usage counts. Card click expands to show composability
// edges; a mini skill-graph at the bottom highlights hub skills.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { SkillLibraryView } from "./ui/SkillLibraryView";

function SkillLibraryModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <SkillLibraryView ctx={ctx} />;
}

export const skillLibraryViewDescriptor: ViewDescriptor = {
  id: "skill-library",
  label: "Skills",
  glyph: "✦",
  hint: "재사용 가능 agent skill 카탈로그",
  tech: "composable skill 그래프 × 입출력 명세",
  usecase: "skill 조합으로 복잡 태스크 구성. 재사용 + 테스트 가능.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 1160,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-agent",
      scope: "repo",
      intent: "explore",
    },
    scopes: ["repo", "task", "file"],
    intents: ["explore", "decide", "explain"],
    subdomain: "skill-graph",
    personas: ["developer", "ai-operator"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "explain",
      cost: "medium",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    related: ["memory-vault", "agent-orchestra", "task-composer"],
    keywords: ["skills", "library", "graph", "reuse", "composable"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate", "route-model"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "compare-related", "attach-to-agent-plan"],
  workflow: {
    usableInStacks: ["agent-delegation-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: SkillLibraryModeView,
};
