// Ownership Sankey view descriptor — author handoff flow.
//
// Reference: Sankey (1898). Modern D3 `d3-sankey` layout.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { OwnershipSankeyView } from "./ui/OwnershipSankeyView";

function OwnershipSankeyModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return (
    <OwnershipSankeyView
      tree={ctx.tree}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
    />
  );
}

export const ownershipSankeyViewDescriptor: ViewDescriptor = {
  id: "ownership-sankey",
  label: "Handoff",
  glyph: "⇢",
  hint: "소유권 핸드오프 — 누가 누구한테 넘겼나",
  tech: "git blame 시간별 primary author 추적",
  usecase: "지식 흐름 시각. 오너십 전환, 팀 간 권한 이동 분석.",
  category: "team",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 610,
  Component: OwnershipSankeyModeView,
};
