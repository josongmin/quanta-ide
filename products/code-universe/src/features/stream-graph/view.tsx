// Stream Graph view descriptor — silhouette-layout stacked area.
//
// Reference: Byron & Wattenberg.
// "Stacked Graphs: Geometry & Aesthetics", IEEE InfoVis 2008.

import type { ReactElement } from "react";
import type {
  ViewContextValue,
  ViewDescriptor,
} from "../view-mode/model/view-descriptor";
import { StreamGraphView } from "./ui/StreamGraphView";

function StreamGraphModeView({ ctx }: { ctx: ViewContextValue }): ReactElement | null {
  if (!ctx.tree) return null;
  return (
    <StreamGraphView
      tree={ctx.tree}
      onFocusEntity={id => ctx.dispatch.selectEntity(id)}
    />
  );
}

export const streamGraphViewDescriptor: ViewDescriptor = {
  id: "stream-graph",
  label: "Stream",
  glyph: "≈",
  hint: "Stream Graph — 패키지 LoC 시간 흐름",
  tech: "Byron & Wattenberg InfoVis 2008 streamgraph layout",
  usecase: "'이 패키지 언제 폭발 성장했나' continuous overview.",
  category: "history",
  contexts: ["repo", "folder"],
  needs: { tree: true },
  order: 740,
  Component: StreamGraphModeView,
};
