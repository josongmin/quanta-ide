// FeatureEnvy view descriptor — Fowler's bad-smell for methods that
// reach into another class more than their own.
// --------------------------------------------------------------------
// Ranked list of offenders on the left, inspector pane on the right
// with a proposed "Move Method → Target" refactor hint.
//
// Reference: Martin Fowler, *Refactoring* (1999); Palomba et al.
// "Detecting Bad Smells in Source Code using Change History"
// (ICSE 2013).

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { FeatureEnvyView } from "./ui/FeatureEnvyView";

function FeatureEnvyModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <FeatureEnvyView ctx={ctx} />;
}

export const featureEnvyViewDescriptor: ViewDescriptor = {
  id: "feature-envy",
  label: "Envy",
  glyph: "↔",
  hint: "Feature Envy — 남의 클래스 데이터만 쓰는 메소드",
  tech: "AST 메소드 접근 카운팅 × 자기 vs 타 클래스",
  usecase: "Move Method 리팩터 후보 식별. Fowler 클래식.",
  category: "refactor",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 440,
  Component: FeatureEnvyModeView,
};
