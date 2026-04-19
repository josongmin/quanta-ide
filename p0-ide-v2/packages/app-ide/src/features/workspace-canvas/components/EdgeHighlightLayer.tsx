import { useLayoutEffect, useRef } from "react";
import type { WorkspaceLayout, LodLevel } from "@quanta/canvas-engine";
import { useInteractionStore } from "../store/interaction-store";

interface Props {
  transform: string;
  layout: WorkspaceLayout | null;
  lod: LodLevel;
}

// EdgeHighlightLayer
// --------------------------------------------------------------------
// SVG redraw of the currently-hovered + selected edge on top of the
// HTML card layer. Same bezier geometry as Pixi's EdgeOverlayRenderer,
// but lifted into the DOM so it stacks ABOVE `StreetCard`/`GroundCard`
// (z-index 5). Without this, at street/ground zoom the cards visually
// occlude the Pixi overlay and the user sees no hover/selection feedback
// even though the interaction fires correctly — the symptom that reads
// as "edge click differs by zoom level".
//
// Only active at street/ground. At galaxy/city/supergalaxy/universe the
// Pixi overlay is unobstructed and painting twice would just double the
// stroke.
//
// Colors / widths mirror EdgeOverlayRenderer's choices (indigo-500 for
// hover, indigo-600 for selection). `vector-effect="non-scaling-stroke"`
// keeps widths constant in CSS-px across the pan/zoom transform, matching
// how Pixi's line thickness is invariant to viewport scale.
export function EdgeHighlightLayer({ transform, layout, lod }: Props) {
  const layerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    const el = layerRef.current;
    if (!el) return;
    el.style.transform = transform;
  }, [transform]);

  const hoveredId = useInteractionStore(s => s.viewState.hoveredEdgeId);
  const selectedId = useInteractionStore(s => s.viewState.selectedEdgeId);

  if (lod !== "street" && lod !== "ground") return null;
  if (!layout) return null;
  if (!hoveredId && !selectedId) return null;

  const routes = layout.edgeRoutes;
  const hover = hoveredId ? routes.get(hoveredId) : undefined;
  const selected = selectedId ? routes.get(selectedId) : undefined;
  if (!hover && !selected) return null;

  return (
    <div ref={layerRef} className="workspace-canvas__edge-highlight-layer">
      <svg
        width="100%"
        height="100%"
        style={{ overflow: "visible", position: "absolute", top: 0, left: 0, pointerEvents: "none" }}
      >
        {hover && (
          <path
            d={`M ${hover.x1},${hover.y1} C ${hover.cx1},${hover.cy1} ${hover.cx2},${hover.cy2} ${hover.x2},${hover.y2}`}
            stroke="#6366f1"
            strokeWidth={4}
            strokeOpacity={0.7}
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
        )}
        {selected && (
          <path
            d={`M ${selected.x1},${selected.y1} C ${selected.cx1},${selected.cy1} ${selected.cx2},${selected.cy2} ${selected.x2},${selected.y2}`}
            stroke="#4f46e5"
            strokeWidth={2.5}
            strokeOpacity={0.95}
            fill="none"
            vectorEffect="non-scaling-stroke"
            strokeLinecap="round"
          />
        )}
      </svg>
    </div>
  );
}
