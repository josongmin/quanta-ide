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
  capabilityKinds: ["view", "decision-input", "gate-check", "policy-control"],
  taxonomy: {
    primary: {
      domain: "se-security-supply-chain",
      scope: "repo",
      intent: "govern",
    },
    scopes: ["repo", "folder"],
    intents: ["govern", "verify"],
    personas: ["security", "manager", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "auditable",
      decisionGrade: "gating",
    },
    domains: ["se-security-supply-chain", "se-quality"],
    subdomain: "vulnerability-management",
    related: ["sbom", "quality-gate", "problems-panel"],
    keywords: ["sast", "cve", "vulnerability", "hotspot", "supply-chain"],
  },
  decision: {
    grade: "gating",
    supports: ["merge", "policy-audit"],
    evidenceClass: "auditable",
    failClosedEligible: true,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-admission-gate", "attach-to-policy-check", "pin-dashboard"],
  workflow: {
    usableInStacks: ["ai-review-stack"],
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
    requiresOrderedExecution: true,
  },
  quality: {
    maturity: "core",
    owner: "security",
  },
  Component: VulnerabilitiesModeView,
};
