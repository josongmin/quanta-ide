// LayerAudit — descriptor for the FSD-layer violation audit view.
// --------------------------------------------------------------------
// Horizontal stacked bands from Shell (top) → Shared (bottom). Each
// package chips into its inferred layer. Curved edges between packages
// are drawn; edges that flow from a lower (closer-to-entity) layer UP
// to a higher layer are structural violations and render in red with a
// warning mark. Clean edges stay thin gray.
//
// The descriptor keeps the view simple on the React side — layer
// assignment + violation calc happen inside the component to satisfy
// the "exactly 3 files per view" budget.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { LayerAuditView } from "./ui/LayerAuditView";

function LayerAuditModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  return <LayerAuditView ctx={ctx} />;
}

export const layerAuditViewDescriptor: ViewDescriptor = {
  id: "layer-audit",
  label: "Layer",
  glyph: "≡",
  hint: "레이어 위반 감사",
  tech: "FSD 규칙 × 의존성 그래프 검증",
  usecase: "아키텍처 경계를 넘는 import 즉시 탐지. CI 대신 시각적 감사.",
  category: "arch",
  contexts: ["repo"],
  needs: { tree: true, graph: true },
  order: 510,
  Component: LayerAuditModeView,
};
