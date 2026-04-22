// CacheROI view descriptor — prompt-caching ROI simulator.
// --------------------------------------------------------------------
// Reference: Anthropic Prompt Caching (August 2024); OpenAI Context
// Caching (2025). Composes churn-based stable/volatile partition with
// a 90-day cost model to quantify "how much does caching save me?"

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { CacheROIView } from "./ui/CacheROIView";

function CacheROIModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <CacheROIView ctx={ctx} />;
}

export const cacheROIViewDescriptor: ViewDescriptor = {
  id: "cache-roi",
  label: "CacheROI",
  glyph: "⟲",
  hint: "프롬프트 캐싱 ROI 시뮬",
  tech: "churn 기반 stable/volatile 분리 × 90일 비용 시뮬",
  usecase: "AI 에이전트 반복 호출 비용을 캐싱으로 얼마 줄일 수 있나. IDE 통합 ROI.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 750,
  Component: CacheROIModeView,
};
