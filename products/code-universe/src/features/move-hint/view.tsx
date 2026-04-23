// Move-hint view descriptor — files detected in the wrong folder.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { MoveHintView } from "./ui/MoveHintView";

function MoveHintModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return (
    <MoveHintView
      tree={ctx.tree}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const moveHintViewDescriptor: ViewDescriptor = {
  id: "move-hint",
  label: "Move",
  glyph: "→",
  hint: "잘못 놓인 파일 감지",
  tech: "의존성 중심성 × 현 위치 불일치",
  usecase: "폴더 구조 정리. '여기 있으면 안 되는 파일' 찾기.",
  category: "refactor",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 410,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "se-refactor-change",
      scope: "folder",
      intent: "decide",
    },
    scopes: ["repo", "folder", "file"],
    intents: ["decide", "optimize", "diagnose"],
    subdomain: "relocation-hints",
    personas: ["developer", "tech-lead"],
    surfaces: ["view", "tab"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "direct-action",
      cost: "low",
      latency: "interactive",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    related: ["package-surface", "change-impact", "feature-envy"],
    keywords: ["move", "hint", "folder", "relocate"],
  },
  decision: {
    grade: "advisory",
    supports: ["refactor"],
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
    maturity: "advanced",
    owner: "platform",
  },
  Component: MoveHintModeView,
};
