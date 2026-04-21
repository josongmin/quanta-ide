// Smell history view descriptor — when each code smell first appeared.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { SmellHistoryView } from "./ui/SmellHistoryView";

function SmellHistoryModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.graph) return null;
  return (
    <SmellHistoryView
      graph={ctx.graph}
      onFocusEntity={id => {
        ctx.dispatch.selectEntity(id);
        ctx.dispatch.openMindMapOn(id);
        ctx.dispatch.setMode("mindmap");
      }}
      onDismiss={() => ctx.dispatch.selectEntity(null)}
    />
  );
}

export const smellHistoryViewDescriptor: ViewDescriptor = {
  id: "smell-history",
  label: "Smells",
  glyph: "◉",
  hint: "코드 스멜이 처음 등장한 시점",
  tech: "스멜 패턴 감지 + git 이력",
  usecase:
    "스멜 도입 시점과 원인 커밋 추적. 특정 스멜이 어떤 개발 패턴에서 반복 발생하는지 파악. 코드 리뷰 가이드라인 개선 근거.",
  category: "history",
  contexts: ["repo"],
  needs: { graph: true },
  order: 130,
  Component: SmellHistoryModeView,
};
