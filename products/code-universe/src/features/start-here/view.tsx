// Start-here view descriptor — onboarding entry-point recommender.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { StartHereView } from "./ui/StartHereView";

function StartHereModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.graph) return null;
  return (
    <StartHereView
      graph={ctx.graph}
      onFocusEntity={id => {
        ctx.dispatch.selectEntity(id);
        ctx.dispatch.openMindMapOn(id);
        ctx.dispatch.setMode("mindmap");
      }}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const startHereViewDescriptor: ViewDescriptor = {
  id: "start-here",
  label: "StartHere",
  glyph: "★",
  hint: "코드베이스 탐색 시작점 추천",
  tech: "의존성 PageRank + 진입점 중심성",
  usecase:
    "새 팀원 온보딩 시 '여기서부터 보세요' 가이드. 낯선 레포 코드리뷰 전 핵심 파일 파악. '이 코드베이스의 핵심이 뭐야?'에 대한 빠른 답.",
  category: "explore",
  contexts: ["repo", "folder", "file"],
  needs: { graph: true },
  order: 70,
  capabilityKinds: ["view", "decision-input", "workflow-step"],
  taxonomy: {
    primary: { domain: "explore", scope: "repo", intent: "decide" },
    scopes: ["repo", "folder", "file"],
    intents: ["decide", "explore", "explain"],
    subdomain: "entrypoint-ranking",
    personas: ["developer", "reviewer", "tech-lead"],
    surfaces: ["view", "tab", "command"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "direct-action",
      cost: "low",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    keywords: ["start", "entrypoint", "onboarding", "pagerank", "core"],
  },
  decision: {
    grade: "advisory",
    supports: ["delegate"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "pin-dashboard"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "core",
    owner: "code-intel",
  },
  Component: StartHereModeView,
};
