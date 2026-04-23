// SBOM — Software Bill of Materials descriptor.
// --------------------------------------------------------------------
// SPDX 2.3 / CycloneDX-style recursive package manifest. Each node in
// the tree carries name + version + license + Sigstore signing state +
// provenance attestation status + CVE count. Top-line summary tiles:
// total packages, signed %, verified provenance %, and package-with-CVE
// count.
//
// Reference: Sigstore · CycloneDX · SPDX 2.3; CISA SBOM guidance
// (aligned with Executive Order 14028 — "Improving the Nation's
// Cybersecurity").

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { SbomView } from "./ui/SbomView";

function SbomModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <SbomView ctx={ctx} />;
}

export const sbomViewDescriptor: ViewDescriptor = {
  id: "sbom",
  label: "SBOM",
  glyph: "⛶",
  hint: "SBOM — 공급망 계보 + provenance",
  tech: "Sigstore × CycloneDX × SPDX 2.3",
  usecase: "공급망 보안. 서명/검증 상태 감사. 규제(EO 14028) 대응.",
  category: "security",
  contexts: ["repo"],
  needs: { tree: true },
  order: 580,
  capabilityKinds: ["view", "decision-input", "gate-check", "policy-control"],
  taxonomy: {
    primary: {
      domain: "se-security-supply-chain",
      scope: "repo",
      intent: "verify",
    },
    scopes: ["repo"],
    intents: ["verify", "govern"],
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
    subdomain: "supply-chain-inventory",
    related: ["vulnerabilities", "quality-gate", "problems-panel"],
    keywords: ["sbom", "spdx", "cyclonedx", "sigstore", "provenance"],
  },
  decision: {
    grade: "gating",
    supports: ["merge", "policy-audit"],
    evidenceClass: "auditable",
    failClosedEligible: true,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-policy-check", "attach-to-admission-gate", "pin-dashboard"],
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
  Component: SbomModeView,
};
