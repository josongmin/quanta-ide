import { useEffect, useMemo, useState } from "react";
import { useSceneStore } from "../store/scene-store";
import { useInteractionStore } from "../store/interaction-store";
import { useViewportStore } from "../store/viewport-store";
import { useFeature } from "../store/feature-flags-store";
import { mockHoverSummary } from "../lib/mock-hover-summary";

// Hover AI summary popover — debounced 300ms so fast mouse traversal across
// the scene never spams the (mock, soon-LLM) summariser. The popover is
// positioned in screen space just above the hovered file's bounding box.
//
// The feature flag controls whether we even *subscribe* to hover state. A
// disabled feature should incur zero DOM diff cost: returning null from the
// component body keeps the tree small.

const HOVER_DEBOUNCE_MS = 300;

export function HoverSummaryPopover() {
  const enabled = useFeature("devmode.hoverSummary");

  const hoveredFileId = useInteractionStore(s => s.viewState.hoveredFileId);
  const graph = useSceneStore(s => s.graph);
  const layout = useSceneStore(s => s.layout);
  const viewport = useViewportStore(s => s.viewport);

  // Debounce the hovered id so the summariser only fires once the cursor has
  // settled. `pending` becomes `resolved` after HOVER_DEBOUNCE_MS elapses.
  const [resolved, setResolved] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setResolved(null);
      return;
    }
    if (!hoveredFileId) {
      setResolved(null);
      return;
    }
    const handle = window.setTimeout(() => {
      setResolved(hoveredFileId);
    }, HOVER_DEBOUNCE_MS);
    return () => window.clearTimeout(handle);
  }, [enabled, hoveredFileId]);

  const file = useMemo(() => {
    if (!resolved || !graph) return null;
    return graph.files.find(f => f.id === resolved) ?? null;
  }, [resolved, graph]);

  const summary = useMemo(() => {
    if (!file || !graph) return null;
    const inbound = graph.fileEdges.filter(e => e.to === file.id);
    const outbound = graph.fileEdges.filter(e => e.from === file.id);
    return mockHoverSummary({ file, inbound, outbound });
  }, [file, graph]);

  const screen = useMemo(() => {
    if (!resolved || !layout) return null;
    const rect = layout.fileRects.get(resolved);
    if (!rect) return null;
    // World -> screen: x_screen = world * scale + viewport.x
    const sx = rect.x * viewport.scale + viewport.x;
    const sy = rect.y * viewport.scale + viewport.y;
    const sw = rect.w * viewport.scale;
    return { x: sx, y: sy, w: sw };
  }, [resolved, layout, viewport]);

  if (!enabled || !file || !summary || !screen) return null;

  // Clamp to viewport: keep the popover inside the container horizontally,
  // and drop it *below* the rect when there's not enough room above.
  const POPOVER_MAX_W = 360;
  const POPOVER_EST_H = 56;
  const margin = 8;
  const containerW = viewport.width || 0;
  const containerH = viewport.height || 0;

  let x = screen.x + screen.w / 2 - POPOVER_MAX_W / 2;
  if (x < margin) x = margin;
  if (x + POPOVER_MAX_W > containerW - margin) {
    x = Math.max(margin, containerW - POPOVER_MAX_W - margin);
  }

  let y = screen.y - POPOVER_EST_H - margin;
  if (y < margin) {
    // Flip below
    y = screen.y + margin + 40;
  }
  if (y + POPOVER_EST_H > containerH - margin) {
    y = Math.max(margin, containerH - POPOVER_EST_H - margin);
  }

  return (
    <div
      className="ws-hover-summary"
      style={{
        position: "absolute",
        left: `${Math.round(x)}px`,
        top: `${Math.round(y)}px`,
        maxWidth: `${POPOVER_MAX_W}px`,
      }}
      role="tooltip"
    >
      <div className="ws-hover-summary__label">ai summary</div>
      <div className="ws-hover-summary__text">{summary}</div>
    </div>
  );
}
