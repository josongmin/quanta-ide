// ContextRot view descriptor — "Lost in the Middle" per-file decay map.
// --------------------------------------------------------------------
// Reference: Liu et al. "Lost in the Middle: How Language Models Use
// Long Contexts" TACL 2023; Kamradt "Needle in a Haystack" 2023;
// "Ruler" long-context benchmark 2024. Every long-context LLM shows a
// U-shape attention decay — tokens in the middle of the prompt lose
// accuracy vs the ends. This view reifies that decay per file so users
// can pick safe slots when stuffing context.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ContextRotView } from "./ui/ContextRotView";

function ContextRotModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <ContextRotView ctx={ctx} />;
}

export const contextRotViewDescriptor: ViewDescriptor = {
  id: "context-rot",
  label: "Rot",
  glyph: "◇",
  hint: "장기 컨텍스트 성능 감쇠 — Lost in the Middle",
  tech: "U-shape position bias 모델링 × 파일별 감도",
  usecase:
    "RAG/에이전트 컨텍스트 넣을 때 순서 최적화. 긴 컨텍스트 안에서 사라지는 파일 식별.",
  category: "ai",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 870,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: {
      domain: "ai-context-model",
      scope: "agent-run",
      intent: "diagnose",
    },
    scopes: ["file", "agent-run", "task"],
    intents: ["diagnose", "optimize", "govern"],
    subdomain: "context-decay",
    personas: ["developer", "ai-operator"],
    surfaces: ["view", "tab"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "triage",
      cost: "low",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "strong",
      decisionGrade: "triage",
    },
    related: ["context-waste", "context-curator", "trajectory-decompose"],
    keywords: ["context", "rot", "decay", "stale", "retries"],
  },
  decision: {
    grade: "triage",
    supports: ["approve-agent-run", "route-model", "delegate"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-agent-plan"],
  workflow: {
    usableInStacks: ["agent-failure-stack", "context-engineering-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: ContextRotModeView,
};
