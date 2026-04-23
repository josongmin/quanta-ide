// DIT view — Depth of Inheritance Tree (CK metric).
// Reference: Chidamber & Kemerer TSE 1994; Microsoft VS documentation.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { DitView } from "./ui/DitView";

function DitModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <DitView ctx={ctx} />;
}

export const ditViewDescriptor: ViewDescriptor = {
  id: "dit",
  label: "DIT",
  glyph: "⩚",
  hint: "상속 깊이 (DIT) 분포",
  tech: "Chidamber & Kemerer DIT, VS 문서 기준",
  usecase: "깊은 상속 트리 감지. 베이스 수정 시 파급 큰 클래스 식별.",
  category: "metrics",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 260,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "se-refactor-change",
      scope: "file",
      intent: "diagnose",
    },
    scopes: ["file", "folder", "repo"],
    intents: ["diagnose", "optimize"],
    personas: ["developer", "reviewer", "tech-lead"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "core",
    signal: {
      dataFreshness: "snapshot",
      confidence: "measured",
      actionability: "explain",
      cost: "low",
      latency: "instant",
      determinism: "deterministic",
      evidenceLevel: "strong",
      decisionGrade: "informational",
    },
    domains: ["se-refactor-change", "se-quality"],
    subdomain: "inheritance-structure",
    related: ["ck-matrix", "control-flow", "structure-outline"],
    keywords: ["dit", "inheritance", "tree", "depth", "oop"],
  },
  decision: {
    grade: "informational",
    supports: ["refactor", "merge"],
    evidenceClass: "strong",
  },
  actions: ["open-tab", "run-analysis", "compare-related"],
  workflow: {
    canBeAutoSuggested: true,
  },
  quality: {
    maturity: "core",
    owner: "platform",
  },
  Component: DitModeView,
};
