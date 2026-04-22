// Vulnerabilities view — SAST findings dashboard (SonarQube / Snyk style).
// Severity bucketed (critical/high/medium/low), CVE ids, hotspot-review
// completion state.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { VulnerabilitiesView } from "./ui/VulnerabilitiesView";

function VulnerabilitiesModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <VulnerabilitiesView ctx={ctx} />;
}

export const vulnerabilitiesViewDescriptor: ViewDescriptor = {
  id: "vulnerabilities",
  label: "Vulns",
  glyph: "⚠",
  hint: "보안 취약점 대시보드",
  tech: "SAST 스캔 룰 × severity × hotspot review",
  usecase: "보안 리뷰 작업. 릴리즈 전 critical 0 검증. CVE 대응 현황 추적.",
  category: "security",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 550,
  Component: VulnerabilitiesModeView,
};
