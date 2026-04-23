// FileGauge view descriptor — single-file quality dashboard.
// --------------------------------------------------------------------
// Reference: SonarSource file-detail page pattern (metric tiles with
// threshold markers and hero numbers). Applied per-file so code
// reviewers get a one-glance readout of the file under review.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { FileGaugeView } from "./ui/FileGaugeView";

function FileGaugeModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  const selectedId = ctx.selectedId;
  const entity = selectedId ? ctx.tree.byId.get(selectedId) : null;
  if (!entity || (entity.kind !== "building" && entity.kind !== "floor" && entity.kind !== "room")) {
    return <FileGaugeView ctx={ctx} empty />;
  }
  return <FileGaugeView ctx={ctx} entity={entity} />;
}

export const fileGaugeViewDescriptor: ViewDescriptor = {
  id: "file-gauge",
  label: "FileGauge",
  glyph: "◎",
  hint: "단일 파일 헬스 대시보드",
  tech: "Sonar file-detail × per-file synth metrics",
  usecase: "이 파일 얼마나 건강한가 한 눈에. 코드리뷰 컨텍스트 브리프.",
  category: "metrics",
  contexts: ["file"],
  needs: { tree: true, selection: true },
  order: 342,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "se-quality",
      scope: "file",
      intent: "explain",
    },
    scopes: ["file", "symbol"],
    intents: ["explain", "verify", "decide"],
    subdomain: "file-health",
    personas: ["developer", "reviewer"],
    surfaces: ["view", "tab"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "direct-action",
      cost: "low",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    related: ["quality-gate", "cognitive-complexity", "file-history"],
    keywords: ["file", "gauge", "health", "review"],
  },
  decision: {
    grade: "advisory",
    supports: ["merge", "refactor"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: false,
  },
  actions: ["open-tab", "run-analysis", "compare-related"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "core",
    owner: "platform",
  },
  Component: FileGaugeModeView,
};
