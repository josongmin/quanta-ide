import { useCallback, useEffect, useRef, useState } from "react";
import type { WorkspaceLayout } from "@quanta/canvas-engine";
import { useFeature } from "../store/feature-flags-store";
import { viewportStore } from "../store/viewport-store";
import { multiSelectionStore, useMultiSelectionStore } from "../store/multi-selection-store";
import { stickiesStore } from "../store/stickies-store";
import { votingStore } from "../store/voting-store";
import { renderSettingsStore } from "../store/render-settings-store";

// Lasso overlay (Batch 7 — power.lasso).
// -------------------------------------------------------------------
// Listens for Shift+drag on the canvas container and renders the
// translucent rectangle in container space. On release we project the
// rectangle into world coordinates using the current viewport, then
// test each file rect's CENTER point against the world-rect:
//
//   rectCenter = (rect.x + rect.w/2, rect.y + rect.h/2)
//   inside iff worldMinX ≤ cx ≤ worldMaxX && worldMinY ≤ cy ≤ worldMaxY
//
// Center-point containment matches Figma's behaviour and avoids the
// ambiguity of partial overlaps at low zoom where a single giant rect
// could nearly cover the lasso.
//
// The overlay is skipped entirely when the feature is off — no extra
// DOM node, no listeners.

interface Props {
  containerRef: React.RefObject<HTMLDivElement | null>;
  layout: WorkspaceLayout | null;
}

interface LassoRect {
  x: number;
  y: number;
  w: number;
  h: number;
}

function dragIntoRect(a: { x: number; y: number }, b: { x: number; y: number }): LassoRect {
  const x = Math.min(a.x, b.x);
  const y = Math.min(a.y, b.y);
  const w = Math.abs(a.x - b.x);
  const h = Math.abs(a.y - b.y);
  return { x, y, w, h };
}

export function LassoOverlay({ containerRef, layout }: Props) {
  const on = useFeature("power.lasso");
  const [rect, setRect] = useState<LassoRect | null>(null);
  const anchorRef = useRef<{ x: number; y: number } | null>(null);

  // Set up pointer listeners on the container. We install listeners
  // with capture so a Shift+drag that starts on the canvas is intercepted
  // before useCanvasInteractions begins a pan.
  useEffect(() => {
    if (!on) return;
    const el = containerRef.current;
    if (!el) return;

    const onDown = (e: PointerEvent) => {
      if (!e.shiftKey) return;
      if (e.button !== 0) return;
      const target = e.target as HTMLElement | null;
      if (target && target.closest(
        ".file-card, .street-card, .ground-card, .ws-sticky, " +
        ".ws-inspector, .ws-palette, .ws-debug, .ws-bulk-toolbar, " +
        "button, a, input, textarea",
      )) return;
      const bounds = el.getBoundingClientRect();
      anchorRef.current = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
      setRect({ x: anchorRef.current.x, y: anchorRef.current.y, w: 0, h: 0 });
      e.preventDefault();
      e.stopPropagation();
    };

    const onMove = (e: PointerEvent) => {
      if (!anchorRef.current) return;
      const bounds = el.getBoundingClientRect();
      const now = { x: e.clientX - bounds.left, y: e.clientY - bounds.top };
      setRect(dragIntoRect(anchorRef.current, now));
    };

    const commit = () => {
      const current = anchorRef.current;
      anchorRef.current = null;
      if (!current) return;
      setRect(prev => {
        if (!prev || (prev.w < 3 && prev.h < 3)) return null;
        if (!layout) return null;
        const vp = viewportStore.getState().viewport;
        if (vp.scale <= 0) return null;
        // Project container-space rect into world coords.
        const wx0 = (prev.x - vp.x) / vp.scale;
        const wy0 = (prev.y - vp.y) / vp.scale;
        const wx1 = (prev.x + prev.w - vp.x) / vp.scale;
        const wy1 = (prev.y + prev.h - vp.y) / vp.scale;
        const minX = Math.min(wx0, wx1);
        const minY = Math.min(wy0, wy1);
        const maxX = Math.max(wx0, wx1);
        const maxY = Math.max(wy0, wy1);
        const hits: string[] = [];
        for (const [id, r] of layout.fileRects.entries()) {
          const cx = r.x + r.w / 2;
          const cy = r.y + r.h / 2;
          if (cx >= minX && cx <= maxX && cy >= minY && cy <= maxY) hits.push(id);
        }
        multiSelectionStore.setSelection(hits);
        return null;
      });
    };

    el.addEventListener("pointerdown", onDown, { capture: true });
    window.addEventListener("pointermove", onMove);
    window.addEventListener("pointerup", commit);
    window.addEventListener("pointercancel", commit);
    return () => {
      el.removeEventListener("pointerdown", onDown, { capture: true } as EventListenerOptions);
      window.removeEventListener("pointermove", onMove);
      window.removeEventListener("pointerup", commit);
      window.removeEventListener("pointercancel", commit);
    };
  }, [on, containerRef, layout]);

  if (!on || !rect) return null;

  return (
    <div
      className="ws-lasso"
      style={{
        left: rect.x,
        top: rect.y,
        width: rect.w,
        height: rect.h,
      }}
    />
  );
}

// Bulk action toolbar — appears above the canvas when the lasso has a
// non-empty selection. Lives alongside LassoOverlay so both opt into the
// same feature flag without duplicating the gate.
export function BulkActionsToolbar({ layout }: { layout: WorkspaceLayout | null }) {
  const on = useFeature("power.lasso");
  const ids = useMultiSelectionStore(s => s.selectedFileIds);

  const addSticky = useCallback(() => {
    if (!layout || ids.length === 0) return;
    for (const id of ids) {
      const rect = layout.fileRects.get(id);
      if (!rect) continue;
      stickiesStore.create(rect.x + rect.w + 12, rect.y, {
        text: "",
        anchorFileId: id,
      });
    }
  }, [ids, layout]);

  const voteAll = useCallback(() => {
    for (const id of ids) votingStore.vote({ kind: "file", id });
  }, [ids]);

  const filterToSelection = useCallback(() => {
    if (ids.length === 0) return;
    // Re-use the edge filter query — a simple `path:` prefix for each id,
    // space-separated, so existing consumers don't need to learn a new op.
    renderSettingsStore.setEdgeFilterQuery(ids.map(id => `path:${id}`).join(" "));
  }, [ids]);

  const clear = useCallback(() => {
    multiSelectionStore.clear();
  }, []);

  if (!on || ids.length === 0) return null;

  return (
    <div className="ws-bulk-toolbar" role="toolbar" aria-label="Bulk actions">
      <span className="ws-bulk-toolbar__count">{ids.length} selected</span>
      <button type="button" className="ws-bulk-toolbar__btn" onClick={addSticky}>
        Add sticky to all
      </button>
      <button type="button" className="ws-bulk-toolbar__btn" onClick={voteAll}>
        Vote all
      </button>
      <button type="button" className="ws-bulk-toolbar__btn" onClick={filterToSelection}>
        Filter to selection
      </button>
      <button type="button" className="ws-bulk-toolbar__btn" onClick={clear}>
        Clear
      </button>
    </div>
  );
}
