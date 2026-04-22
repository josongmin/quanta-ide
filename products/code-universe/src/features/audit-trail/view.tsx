// AuditTrail view descriptor.
// --------------------------------------------------------------------
// Chronological log of every agent action. Filters × timeline list ×
// 24h × 14d activity heatmap sidebar.
//
// Reference: SOC2 / ISO 27001 audit log standards; Kubernetes audit
// log; AWS CloudTrail.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { AuditTrailView } from "./ui/AuditTrailView";

function AuditTrailModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <AuditTrailView ctx={ctx} />;
}

export const auditTrailViewDescriptor: ViewDescriptor = {
  id: "audit-trail",
  label: "Audit",
  glyph: "◰",
  hint: "감사 로그 — 에이전트의 모든 액션",
  tech: "SOC2 audit log × action kind × outcome",
  usecase: "보안 감사. '에이전트가 뭘 건드렸나' 타임라인. 규제 대응.",
  category: "ai",
  contexts: ["repo"],
  needs: { tree: true },
  order: 1000,
  Component: AuditTrailModeView,
};
