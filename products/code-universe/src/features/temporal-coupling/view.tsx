// Temporal Coupling — co-change rendered as a musical staff.
// --------------------------------------------------------------------
// Each horizontal line = a file. Each commit that touches N files draws
// a "chord" — simultaneous notes on that column. Files that change
// together over and over form recurring chord patterns; unrelated files
// appear as lone notes. Visual only (no audio), but the mental model is
// musical so the view earns its original "music" framing.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { TemporalCouplingView } from "./ui/TemporalCouplingView";

function TemporalCouplingModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <TemporalCouplingView ctx={ctx} />;
}

export const temporalCouplingViewDescriptor: ViewDescriptor = {
  id: "temporal-coupling",
  label: "Coupling",
  glyph: "♬",
  hint: "시간적 결합 — 동시 변경 코드를 chord로"
,
  tech: "co-change × 악보 스타일 시각화",
  usecase: "항상 같이 바뀌는 파일 묶음 식별. 숨은 커플링을 음표 리듬으로 인지.",
  category: "history",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 720,
  Component: TemporalCouplingModeView,
};
