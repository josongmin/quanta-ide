// DependencyHealth — supply-chain audit dashboard.
// --------------------------------------------------------------------
// Per-package view of top-level deps: current vs latest version,
// update kind (patch/minor/major), vulnerability counts colored by
// severity, license tag, install-size bar, weekly-download sparkline.
//
// Reference (industry practice):
//   - Dependabot (GitHub Advisory DB driven update alerts).
//   - Snyk Open Source (vuln + license scanning).
//   - Socket.dev (supply-chain risk scoring for npm).

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { DependencyHealthView } from "./ui/DependencyHealthView";

function DependencyHealthModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <DependencyHealthView ctx={ctx} />;
}

export const dependencyHealthViewDescriptor: ViewDescriptor = {
  id: "dependency-health",
  label: "DepHealth",
  glyph: "⛂",
  hint: "의존성 건강 — version/update/vuln/license/size",
  tech: "package registry × npm audit × license scan",
  usecase: "supply chain 감사. critical vuln 0 달성 여부. '업데이트 할 것' 스캔.",
  category: "security",
  contexts: ["repo"],
  needs: { tree: true },
  order: 570,
  Component: DependencyHealthModeView,
};
