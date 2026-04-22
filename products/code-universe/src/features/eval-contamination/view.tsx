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
  Component: EvalContaminationModeView,
};
