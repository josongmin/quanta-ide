// EvalContamination view descriptor — training-data overlap audit.
// --------------------------------------------------------------------
// Reference: Magar & Schwartz "Data Contamination: From Memorization to
// Exploitation" EMNLP 2022; Dodge et al. "Documenting Large Webtext
// Corpora" EMNLP 2021; Balloccu et al. "Leak, Cheat, Repeat" 2024.
// Audits which files may be in model training data: public repos with
// stars, old code, popular patterns = more likely seen. If likely-seen,
// benchmarks over-estimate deployment performance.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { EvalContaminationView } from "./ui/EvalContaminationView";

function EvalContaminationModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <EvalContaminationView ctx={ctx} />;
}

export const evalContaminationViewDescriptor: ViewDescriptor = {
  id: "eval-contamination",
  label: "Contam",
  glyph: "◈",
  hint: "학습 데이터 contamination 감사",
  tech: "public repo × star × age × pattern popularity",
  usecase: "이 코드 모델이 봤을 확률. 벤치마크 허수 방지.",
  category: "ai",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 1060,
  capabilityKinds: ["view", "decision-input", "policy-control"],
  taxonomy: {
    primary: {
      domain: "ai-trust-governance",
      scope: "repo",
      intent: "verify",
    },
    scopes: ["repo", "folder", "file"],
    intents: ["verify", "govern", "explain"],
    subdomain: "training-data-overlap",
    personas: ["manager", "security", "ai-operator"],
    surfaces: ["view", "tab", "dashboard-card"],
    maturity: "advanced",
    signal: {
      dataFreshness: "snapshot",
      confidence: "estimated",
      actionability: "triage",
      cost: "medium",
      latency: "interactive",
      determinism: "bounded",
      evidenceLevel: "strong",
      decisionGrade: "advisory",
    },
    related: ["benchmark-gap", "blind-spot", "audit-trail"],
    keywords: ["eval", "contamination", "training", "overlap", "memorization"],
  },
  decision: {
    grade: "advisory",
    supports: ["policy-audit", "merge"],
    evidenceClass: "strong",
    failClosedEligible: false,
    humanReviewRequired: true,
  },
  actions: ["open-tab", "run-analysis", "attach-to-policy-check", "compare-related"],
  workflow: {
    canBeAutoSuggested: true,
    canBeAutoAttached: false,
    requiresOrderedExecution: false,
  },
  quality: {
    maturity: "advanced",
    owner: "ai-platform",
  },
  Component: EvalContaminationModeView,
};
