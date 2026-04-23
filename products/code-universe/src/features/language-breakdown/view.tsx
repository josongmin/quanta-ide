// LanguageBreakdown view descriptor — GitHub-style repo language mix.
// --------------------------------------------------------------------
// References:
//   - GitHub repository language bar (horizontal stacked bar + legend).
//   - GitHub Linguist — file-extension → language classifier.
// Applied here: LoC-weighted language share with a ranked "top files"
// list per language for onboarding tour-guidance.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { LanguageBreakdownView } from "./ui/LanguageBreakdownView";

function LanguageBreakdownModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <LanguageBreakdownView ctx={ctx} />;
}

export const languageBreakdownViewDescriptor: ViewDescriptor = {
  id: "language-breakdown",
  label: "Langs",
  glyph: "⌬",
  hint: "언어 분포 — repo 내 LoC 비율",
  tech: "파일 확장자 × LoC 집계",
  usecase: "polyglot repo의 언어 구성 한 눈에. 온보딩용.",
  category: "metrics",
  contexts: ["repo"],
  needs: { tree: true },
  order: 347,
  capabilityKinds: ["view", "decision-input"],
  taxonomy: {
    primary: {
      domain: "productivity",
      scope: "repo",
      intent: "explore",
    },
    scopes: ["repo", "folder"],
    intents: ["explore", "diagnose"],
    personas: ["platform", "tech-lead", "manager"],
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
    domains: ["productivity"],
    subdomain: "language-mix",
    related: ["structure-outline", "problems-panel", "devex-health"],
    keywords: ["language", "linguist", "mix", "loc", "onboarding"],
  },
  decision: {
    grade: "informational",
    supports: ["merge", "refactor"],
    evidenceClass: "strong",
  },
  actions: ["open-tab", "run-analysis", "pin-dashboard"],
  workflow: {
    canBeAutoSuggested: true,
  },
  quality: {
    maturity: "core",
    owner: "platform",
  },
  Component: LanguageBreakdownModeView,
};
