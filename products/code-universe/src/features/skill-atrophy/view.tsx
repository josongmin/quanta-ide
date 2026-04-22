// SkillAtrophy view descriptor — per-developer AI-reliance trends.
// --------------------------------------------------------------------
// Reference: Microsoft Research / CMU 2025 "Critical Thinking Atrophy
// in AI-Assisted Coding"; Stanford HCI on developer skills; ACM Queue
// 2024 "The Two-Edged Sword of AI Pair Programming". Tracks 12-week
// trend of AI-assisted ratio rising while human-only LoC falls —
// signals over-reliance that warrants team-health intervention.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { SkillAtrophyView } from "./ui/SkillAtrophyView";

function SkillAtrophyModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <SkillAtrophyView ctx={ctx} />;
}

export const skillAtrophyViewDescriptor: ViewDescriptor = {
  id: "skill-atrophy",
  label: "Atrophy",
  glyph: "↧",
  hint: "개발자 AI 과의존 트렌드",
  tech: "AI 비율 상승 × 인간 LoC 하락 composite 지수",
  usecase: "팀 건강성. 'AI 없으면 코딩 못 함' 단계 예방.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 1040,
  Component: SkillAtrophyModeView,
};
