// Tool Profile view descriptor — per-file tool-use analytics.
// --------------------------------------------------------------------
// Reference: OpenAI Function Calling observability; Anthropic Claude
// Code telemetry; tool-use audit patterns (2024-2025).

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ToolProfileView } from "./ui/ToolProfileView";

function ToolProfileModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  const entity = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) {
    return <ToolProfileView ctx={ctx} empty />;
  }
  return <ToolProfileView ctx={ctx} entity={entity} />;
}

export const toolProfileViewDescriptor: ViewDescriptor = {
  id: "tool-profile",
  label: "Tools",
  glyph: "⚒",
  hint: "도구 사용 프로파일 — 파일별 tool 분포",
  tech: "AgentStep.toolName × 집계 (6 태스크 aggregated)",
  usecase: "에이전트가 이 파일에 어떤 tool 많이 쓰나. bash 비중 높으면 테스트 driven.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 830,
  Component: ToolProfileModeView,
};
