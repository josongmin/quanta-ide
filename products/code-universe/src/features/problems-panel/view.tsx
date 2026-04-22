// ProblemsPanel view descriptor — unified compiler/linter diagnostic inbox.
// --------------------------------------------------------------------
// References:
//   - Visual Studio Code "Problems" panel — severity bucketed diagnostic
//     feed aggregated across every registered language server.
//   - JetBrains IntelliJ IDEA "Problems tool window" — project-wide
//     inspections with AND-combined severity + source filters.
// Applied here: repo-level single pane of glass for tsc / eslint / biome /
// vitest / semgrep output, with click-through to the offending file.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { ProblemsPanelView } from "./ui/ProblemsPanelView";

function ProblemsPanelModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return <ProblemsPanelView ctx={ctx} />;
}

export const problemsPanelViewDescriptor: ViewDescriptor = {
  id: "problems-panel",
  label: "Problems",
  glyph: "◑",
  hint: "통합 문제 패널 — 컴파일러/린터 출력",
  tech: "tsc / eslint / biome / semgrep 통합 diagnostic",
  usecase: "IDE 기본. 에러 몇 개 있는지 한 눈에, 소스별 필터.",
  category: "metrics",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 345,
  Component: ProblemsPanelModeView,
};
