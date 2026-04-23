// MessageCodeMismatch view descriptor — PR story vs actual patch reality.
// --------------------------------------------------------------------
// Reference: trust calibration for code review. Good AI-native IDEs must
// show when the textual claim drifts from the code and tests.

import type { ReactElement } from "react";
import type { Entity } from "@quanta/canvas-engine";
import type { ViewContextValue, ViewDescriptor } from "../view-mode/model/view-descriptor";
import { MessageCodeMismatchView } from "./ui/MessageCodeMismatchView";

function MessageCodeMismatchModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const entity: Entity | null = ctx.selectedId ? ctx.tree.byId.get(ctx.selectedId) ?? null : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor")) return <MessageCodeMismatchView ctx={ctx} empty />;
  return <MessageCodeMismatchView ctx={ctx} entity={entity} />;
}

export const messageCodeMismatchViewDescriptor = {
  id: "message-code-mismatch",
  label: "MsgCode",
  glyph: "≋",
  hint: "PR 설명과 실제 코드 변화가 얼마나 어긋나는지 추적",
  tech: "statement-by-statement alignment × mismatch rationale",
  usecase: "AI가 설명은 그럴듯하지만 코드는 다른 방향으로 바꾼 경우를 빠르게 잡음.",
  category: "ai",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 1210,
  capabilityKinds: ["view", "decision-input", "gate-check"],
  taxonomy: {
    primary: {
      domain: "ai-trust-governance",
      scope: "diff",
      intent: "diagnose",
    },
    domains: ["ai-trust-governance", "se-testing"],
    scopes: ["diff", "file"],
    intents: ["diagnose", "verify"],
    subdomain: "claim-drift",
    personas: ["reviewer", "tech-lead", "developer"],
    surfaces: ["view", "tab", "diff-inline"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "medium",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "gating",
    },
    related: ["diff-evidence", "review-burden", "decision-log"],
    keywords: ["mismatch", "review", "claim", "diff", "tests", "spec", "trace"],
  },
  decision: {
    grade: "gating",
    supports: ["merge", "escalate-review"],
    evidenceClass: "strong",
    failClosedEligible: true,
    humanReviewRequired: true,
  },
  actions: [
    "open-view",
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
    maturity: "advanced",
  },
  Component: MessageCodeMismatchModeView,
} as ViewDescriptor;
