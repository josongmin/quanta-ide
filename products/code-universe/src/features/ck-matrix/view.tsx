// CK Matrix view descriptor — Chidamber & Kemerer TSE 1994.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { CKMatrixView } from "./ui/CKMatrixView";

function CKMatrixModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  if (ctx.viewportSize.w <= 0 || ctx.viewportSize.h <= 0) return null;
  return <CKMatrixView ctx={ctx} />;
}

export const ckMatrixViewDescriptor: ViewDescriptor = {
  id: "ck-matrix",
  label: "CK",
  glyph: "⊞",
  hint: "CK 메트릭 — 결합도 × 응집도",
  tech: "Chidamber-Kemerer CBO × LCOM (1994)",
  usecase:
    "OO 설계 감사. '결합 많고 응집 낮은' 클래스가 리팩터 1순위.",
  category: "metrics",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 240,
  Component: CKMatrixModeView,
};
