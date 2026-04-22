// AIAuthorship view descriptor — per-file AI-authored ratio.
// --------------------------------------------------------------------
// Reference: GitHub Copilot telemetry studies (2023-2024); JetBrains
// Developer Ecosystem AI adoption reports (2024-2025); Bird et al.
// "Taking Flight with Copilot" CACM 2023. Heuristic blend of commit
// co-authorship signatures + style fingerprinting. Novel 2026 lens —
// "AI-authorship as a governance-visible software metric."

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { AIAuthorshipView } from "./ui/AIAuthorshipView";

function AIAuthorshipModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <AIAuthorshipView ctx={ctx} />;
}

export const aiAuthorshipViewDescriptor: ViewDescriptor = {
  id: "ai-authorship",
  label: "AIAuthor",
  glyph: "◈",
  hint: "AI 작성 비율 — 파일별 기원",
  tech: "commit co-author × style signature 휴리스틱",
  usecase: "AI 의존도 감사. 리스크 있는 고AI 파일 identify. 팀 거버넌스.",
  category: "ai",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 760,
  Component: AIAuthorshipModeView,
};
