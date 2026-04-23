// DiffEvidence view descriptor — every hunk should point back to evidence.
// --------------------------------------------------------------------
// Reference: evidence-linked review and traceability as a trust layer for
// coding agents; complements verification surfaces and review burden work.

import type { ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue, ViewDescriptor } from "../view-mode/model/view-descriptor";
import { DiffEvidenceView } from "./ui/DiffEvidenceView";

function DiffEvidenceModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const entity: Entity | null = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) ?? null : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) return <DiffEvidenceView ctx={ctx} empty />;
  return <DiffEvidenceView ctx={ctx} entity={entity} />;
}

export const diffEvidenceViewDescriptor = {
  id: "diff-evidence",
  label: "DiffProof",
  glyph: "⋮",
  hint: "각 diff hunk가 어떤 test / spec / trace에 기대는지 보여줌",
  tech: "support score × evidence kind matrix × unsupported claim count",
  usecase: "코드 리뷰 때 '왜 이 수정이 정당한가'를 hunk 단위로 검증.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 1130,
  capabilityKinds: ["view", "decision-input", "gate-check"],
  taxonomy: {
    primary: {
      domain: "ai-trust-governance",
      scope: "diff",
      intent: "verify",
    },
    domains: ["ai-trust-governance", "se-testing"],
    scopes: ["diff", "file"],
    intents: ["verify", "decide"],
    subdomain: "evidence-linked-review",
    personas: ["reviewer", "tech-lead", "security"],
    surfaces: ["view", "tab", "diff-inline"],
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
    related: ["message-code-mismatch", "review-burden", "quality-gate"],
    keywords: ["diff", "evidence", "traceability", "audit", "review", "hunk"],
  },
  decision: {
    grade: "gating",
    supports: ["merge"],
    evidenceClass: "auditable",
    failClosedEligible: true,
    humanReviewRequired: true,
  },
  actions: [
    "open-tab",
    "run-analysis",
    "attach-to-pr-review",
    "attach-to-admission-gate",
  ],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: true,
  },
  quality: {
    maturity: "core",
  },
  Component: DiffEvidenceModeView,
} as ViewDescriptor;
