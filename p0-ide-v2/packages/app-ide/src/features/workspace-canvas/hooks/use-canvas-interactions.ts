import { useCallback, useEffect, useRef } from "react";
import type { EdgePickIndex } from "@quanta/canvas-engine";
import { sceneStore } from "../store/scene-store";
import { viewportStore } from "../store/viewport-store";
import { interactionStore } from "../store/interaction-store";
import { stickiesStore } from "../store/stickies-store";
import { annotationsStore } from "../store/annotations-store";
import type { ModifierState } from "./use-keyboard-shortcuts";

// Drag vs click disambiguation: a pan gesture and an intra-element click
// both terminate with a pointerup. We count movement between mousedown
// and the trailing click, and suppress clicks that follow a real drag.
const CLICK_SLOP_PX = 5;

/**
 * Central contract for "this event originated over a UI overlay, the canvas
 * must keep its hands off". The canvas owns pan/zoom/edge-pick; everything
 * layered on top (inline editor, inspector, popover, sticky editor, …) is
 * an overlay. Without a single yield policy, every overlay had to remember
 * to call `e.stopPropagation()` and the ones that forgot silently leaked
 * their scroll/pan into the canvas — which is the bug this helper fixes.
 *
 * Two yield signals, both walked from the event target up to (but excluding)
 * the canvas container:
 *
 *   1. `data-canvas-opaque="true"` — explicit opt-out. Popovers/dropdowns
 *      that don't scroll but must not start a canvas pan on mousedown set
 *      this. One attribute, no JS ceremony.
 *   2. A *scrollable* ancestor (`overflow: auto | scroll` with real overflow
 *      content) — automatic, CSS-driven. The browser already knows this
 *      element wants the wheel; edge-pick and wheel handlers stop fighting
 *      it. Not consulted on mousedown: pan-vs-scroll ambiguity there is
 *      resolved by `.file-card/button/a` short-circuits and the annotation-
 *      tool guard; overlays that explicitly must not pan set the attribute.
 *
 * Note: we accept `EventTarget | null` so callers can pass `e.target`
 * directly from either native events or React SyntheticEvents without a cast.
 */
function shouldYieldToOverlay(
  startEl: EventTarget | null,
  canvasEl: HTMLElement,
  checkScrollable: boolean,
): boolean {
  let node: Node | null = startEl instanceof Node ? startEl : null;
  while (node && node !== canvasEl) {
    if (node instanceof HTMLElement) {
      if (node.dataset.canvasOpaque === "true") return true;
      if (checkScrollable) {
        const cs = getComputedStyle(node);
        const oy = cs.overflowY;
        if ((oy === "auto" || oy === "scroll") && node.scrollHeight > node.clientHeight) return true;
        const ox = cs.overflowX;
        if ((ox === "auto" || ox === "scroll") && node.scrollWidth > node.clientWidth) return true;
      }
    }
    node = node.parentNode;
  }
  return false;
}

/**
 * World-coord hit-test gate. Edge-pick and zoom-to-fit operate against a
 * spatial index keyed by world coordinates; that index has no knowledge of
 * DOM z-stacking, so it happily returns an edge that is visually occluded
 * by a card/sticky/annotation/badge the user actually clicked on. Short
 * answer: those operations may run ONLY when the pointer is over the bare
 * canvas surface — the container root itself or the Pixi `<canvas>` child.
 * Any other descendant is, by construction, a DOM overlay (dom-layer is
 * pointer-events:none, every card/panel/toolbar sets pointer-events:auto)
 * and owns the event. This supersets the previous data-canvas-opaque /
 * scrollable-ancestor signals — both describe non-canvas elements and are
 * automatically caught here, so individual overlays no longer need to
 * opt in. Keep `shouldYieldToOverlay` for pan/wheel which must still start
 * over cards (cards are not draggable; pan-from-card is intentional UX).
 */
function isCanvasWorldTarget(target: EventTarget | null, canvasEl: HTMLElement): boolean {
  if (target === canvasEl) return true;
  return target instanceof HTMLCanvasElement && target.parentElement === canvasEl;
}

interface CanvasInteractionHandlers {
  onMouseDown: (e: React.MouseEvent) => void;
  onMouseMove: (e: React.MouseEvent) => void;
  onMouseUp: () => void;
  selectFile: (id: string) => void;
  hoverFile: (id: string | null) => void;
  hoverCluster: (id: string | null) => void;
  hoverSupercluster: (id: string | null) => void;
  onClusterClick: (clusterId: string) => void;
  onSuperclusterClick: (superclusterId: string) => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export interface UseCanvasInteractionsOpts {
  containerRef: React.RefObject<HTMLDivElement | null>;
  edgePickIndexRef: React.MutableRefObject<EdgePickIndex>;
  modifiers: ModifierState;
  panBy: (dx: number, dy: number) => void;
  zoomAt: (delta: number, x: number, y: number) => void;
  viewportWidth: number;
  viewportHeight: number;
}

/**
 * Wires the full canvas interaction surface:
 *   - shift+click / cmd+click semantics on file selection
 *   - drag-vs-click guard
 *   - RAF-batched pan + zoom (wheel, mouse drag)
 *   - container-level dblclick: zoom-to-fit or shift+dblclick → sticky
 *   - mousemove/click for edge pick (hover + cmd+click evidence)
 *   - cluster / supercluster zoom-to-fit
 *
 * Returned handlers are referentially stable; state lives on refs so a
 * shift-modifier or drag-distance update can't re-render the canvas.
 */
export function useCanvasInteractions(opts: UseCanvasInteractionsOpts): CanvasInteractionHandlers {
  const { containerRef, edgePickIndexRef, modifiers, panBy, zoomAt, viewportWidth, viewportHeight } = opts;
  const { shiftHeldRef, metaHeldRef } = modifiers;

  // Drag-distance + click-consumed refs.
  const dragDistance = useRef(0);
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const edgeClickConsumedRef = useRef(false);

  const wasDragGesture = useCallback(() => dragDistance.current > CLICK_SLOP_PX, []);

  // RAF-batched pan/zoom.
  const pendingPan = useRef({ dx: 0, dy: 0 });
  const pendingZoom = useRef<{ delta: number; x: number; y: number } | null>(null);
  const rafId = useRef<number | null>(null);
  const flush = useCallback(() => {
    rafId.current = null;
    if (pendingZoom.current) {
      const { delta, x, y } = pendingZoom.current;
      pendingZoom.current = null;
      zoomAt(delta, x, y);
    }
    const { dx, dy } = pendingPan.current;
    if (dx !== 0 || dy !== 0) {
      pendingPan.current.dx = 0;
      pendingPan.current.dy = 0;
      panBy(dx, dy);
    }
  }, [panBy, zoomAt]);
  const scheduleFlush = useCallback(() => {
    if (rafId.current === null) rafId.current = requestAnimationFrame(flush);
  }, [flush]);

  useEffect(() => () => {
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
  }, []);

  // File click — carries selection, shift+click path-query, cmd+click
  // evidence drill-down. edgeClickConsumed guards against the edge-pick
  // handler firing on the same pointerup (cmd+click can hit an edge OR
  // a file).
  const selectFile = useCallback((id: string) => {
    if (wasDragGesture()) return;
    if (edgeClickConsumedRef.current) {
      edgeClickConsumedRef.current = false;
      return;
    }
    if (metaHeldRef.current) {
      const g = sceneStore.getState().graph;
      const proofs = g?.proofs;
      if (proofs) {
        const hit = g.fileEdges.find(
          e => (e.from === id || e.to === id) && e.evidenceId && proofs[e.evidenceId],
        );
        if (hit?.evidenceId) {
          interactionStore.setInspectedEvidence(hit.evidenceId);
          return;
        }
      }
    }
    const prevSel = interactionStore.getState().viewState.selectedFileId;
    if (shiftHeldRef.current && prevSel && prevSel !== id) {
      interactionStore.setPathQuery({
        sourceFileId: prevSel,
        targetFileId: id,
        mode: "shortest",
      });
      return;
    }
    if (interactionStore.getState().pathQuery) interactionStore.clearPathQuery();
    interactionStore.selectFile(id);
  }, [wasDragGesture, metaHeldRef, shiftHeldRef]);

  const hoverFile = useCallback((id: string | null) => interactionStore.hoverFile(id), []);
  // Cluster / supercluster hover callbacks — the Pixi renderers at those tiers
  // already fire pointerover/pointerout, the store already tracks the ids;
  // this just connects the two. Same hover pipeline as files at every LOD.
  const hoverCluster = useCallback((id: string | null) => interactionStore.hoverCluster(id), []);
  const hoverSupercluster = useCallback((id: string | null) => interactionStore.hoverSupercluster(id), []);

  // Mouse drag for pan.
  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button,a,.file-card")) return;
    // Overlay opt-out: popovers, dropdowns, modals marked [data-canvas-opaque]
    // must not start a canvas pan. See shouldYieldToOverlay for the contract.
    const canvasEl = containerRef.current;
    if (canvasEl && shouldYieldToOverlay(e.target, canvasEl, false)) return;
    // Annotation tool active → drawing takes over, pan must not start.
    // Otherwise pointerdown would draw while mousedown simultaneously pans.
    if (annotationsStore.getState().activeTool !== "none") return;
    e.preventDefault();
    dragging.current = true;
    dragDistance.current = 0;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, [containerRef]);
  const onMouseMove = useCallback((e: React.MouseEvent) => {
    if (!dragging.current) return;
    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    dragDistance.current += Math.abs(dx) + Math.abs(dy);
    pendingPan.current.dx += dx;
    pendingPan.current.dy += dy;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    scheduleFlush();
  }, [scheduleFlush]);
  const onMouseUp = useCallback(() => { dragging.current = false; }, []);

  // Wheel (non-passive for preventDefault).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      // ctrl/meta + wheel == browser pinch-zoom intent (trackpad pinch
      // arrives as ctrlKey+wheel). Must preventDefault *before* the
      // overlay-yield return — otherwise pinching on an overlay
      // ([data-canvas-opaque]: inspector, inline-editor, sticky, …)
      // escapes into visualViewport zoom and persists after leaving
      // the canvas. ctrl+scroll is never a scroll intent in the IDE.
      const isZoomIntent = e.ctrlKey || e.metaKey;
      if (isZoomIntent) e.preventDefault();
      // Yield to any scrollable overlay (inline editor, inspector body,
      // debug-hud sections, …) or anything explicitly opted out via
      // [data-canvas-opaque]. Without this the canvas swallows every wheel
      // tick inside the container and turns editor scroll into canvas pan.
      if (shouldYieldToOverlay(e.target, el, true)) return;
      if (!isZoomIntent) e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (isZoomIntent) {
        // Zoom deltas accumulate too — multiple wheel ticks in one frame
        // collapse into one zoomAt with summed delta around the last cursor.
        const delta = e.deltaY * -0.02;
        const px = e.clientX - rect.left;
        const py = e.clientY - rect.top;
        if (pendingZoom.current) {
          pendingZoom.current.delta += delta;
          pendingZoom.current.x = px;
          pendingZoom.current.y = py;
        } else {
          pendingZoom.current = { delta, x: px, y: py };
        }
      } else {
        pendingPan.current.dx += -e.deltaX;
        pendingPan.current.dy += -e.deltaY;
      }
      scheduleFlush();
    };
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  }, [containerRef, scheduleFlush]);

  // dblclick: fit to selected file (plain) or drop a sticky (shift).
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onDblClick = (e: MouseEvent) => {
      // Sticky-drop and zoom-to-fit both target the world; they must only
      // fire when the dbl-click lands on the bare canvas surface. Any DOM
      // overlay (card, sticky, annotation, badge, toolbar, …) owns its
      // own dbl-click semantics (e.g. card dbl-click enters inline-edit).
      if (!isCanvasWorldTarget(e.target, el)) return;
      if (e.shiftKey) {
        const vp = viewportStore.getState().viewport;
        if (vp.scale <= 0) return;
        const rect = el.getBoundingClientRect();
        const cx = e.clientX - rect.left;
        const cy = e.clientY - rect.top;
        const worldX = (cx - vp.x) / vp.scale;
        const worldY = (cy - vp.y) / vp.scale;
        const defaultW = 180;
        const defaultH = 120;
        stickiesStore.create(worldX - defaultW / 2, worldY - defaultH / 2);
        e.preventDefault();
        e.stopPropagation();
        return;
      }
      const lay = sceneStore.getState().layout;
      const sel = interactionStore.getState().viewState.selectedFileId;
      if (!lay) return;
      const vp = viewportStore.getState().viewport;
      let rect: { x: number; y: number; w: number; h: number } | undefined;
      if (sel) rect = lay.fileRects.get(sel);
      if (!rect) rect = lay.totalBounds;
      if (!rect || rect.w <= 0 || rect.h <= 0 || vp.width <= 0 || vp.height <= 0) return;
      const FILL = sel ? 0.85 : 0.9;
      const rawScale = Math.min(vp.width / rect.w, vp.height / rect.h) * FILL;
      const scale = Math.min(2.5, Math.max(0.001, rawScale));
      const cx = rect.x + rect.w / 2;
      const cy = rect.y + rect.h / 2;
      const x = vp.width / 2 - cx * scale;
      const y = vp.height / 2 - cy * scale;
      viewportStore.setViewport({ ...vp, x, y, scale });
    };
    el.addEventListener("dblclick", onDblClick);
    return () => el.removeEventListener("dblclick", onDblClick);
  }, [containerRef]);

  // Edge-pick hover + cmd+click evidence drill-down.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    // Mirrors hoveredEdgeId onto the canvas root so CSS can swap to a
    // pointer cursor when an edge is under the cursor. Kept as a data-attr
    // (matching the annotation-tool pattern) so the cursor change stays
    // CSS-driven and no inline style thrash lands on the root element.
    const setEdgeHoverAttr = (on: boolean) => {
      if (on) el.setAttribute("data-edge-hover", "on");
      else el.removeAttribute("data-edge-hover");
    };
    const onMove = (e: MouseEvent) => {
      // Edge hover is a world-coord hit-test; only fire when the cursor is
      // over the bare canvas surface. Any DOM overlay the user is moving
      // across — card, sticky, annotation, badge, folder frame, toolbar —
      // owns the event and must not ghost-hover an edge underneath it.
      if (!isCanvasWorldTarget(e.target, el)) {
        if (interactionStore.getState().viewState.hoveredEdgeId !== null) {
          interactionStore.hoverEdge(null);
        }
        setEdgeHoverAttr(false);
        return;
      }
      const rect = el.getBoundingClientRect();
      const vp = viewportStore.getState().viewport;
      if (vp.scale <= 0) return;
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const worldX = (cx - vp.x) / vp.scale;
      const worldY = (cy - vp.y) / vp.scale;
      const tol = 8 / vp.scale;
      const hit = edgePickIndexRef.current.pickAt(worldX, worldY, tol);
      const currentHover = interactionStore.getState().viewState.hoveredEdgeId;
      const nextId = hit?.id ?? null;
      if (currentHover !== nextId) interactionStore.hoverEdge(nextId);
      setEdgeHoverAttr(nextId !== null);
    };
    const onClick = (e: MouseEvent) => {
      if (wasDragGesture()) return;
      // Same world-coord hit-test contract as onMove: clicks on any DOM
      // overlay (card, sticky, annotation, badge, editor, inspector, …)
      // must NOT bleed through to pick an edge that happens to sit under
      // the overlay in world space. Only bare canvas targets qualify.
      if (!isCanvasWorldTarget(e.target, el)) return;
      const rect = el.getBoundingClientRect();
      const vp = viewportStore.getState().viewport;
      if (vp.scale <= 0) return;
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const worldX = (cx - vp.x) / vp.scale;
      const worldY = (cy - vp.y) / vp.scale;
      const tol = 8 / vp.scale;
      const hit = edgePickIndexRef.current.pickAt(worldX, worldY, tol);
      if (!hit) {
        // Empty-canvas click = focus returns to canvas. The world-target
        // gate above already guarantees `e.target` is the bare canvas, so
        // no further overlay filtering is needed here.
        interactionStore.resetSelection();
        return;
      }
      const g = sceneStore.getState().graph;
      const proofs = g?.proofs;
      // Cmd/Ctrl-click on an edge with evidence → drill down to proof bundle.
      // Plain click → select edge so its info popover surfaces.
      if ((e.metaKey || e.ctrlKey) && hit.evidenceId && proofs && proofs[hit.evidenceId]) {
        edgeClickConsumedRef.current = true;
        interactionStore.setInspectedEvidence(hit.evidenceId);
        return;
      }
      edgeClickConsumedRef.current = true;
      interactionStore.selectEdgeAt(hit.id, worldX, worldY);
    };
    const onLeave = () => {
      if (interactionStore.getState().viewState.hoveredEdgeId !== null) {
        interactionStore.hoverEdge(null);
      }
      setEdgeHoverAttr(false);
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("click", onClick, true);
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("mouseleave", onLeave);
      setEdgeHoverAttr(false);
    };
  }, [containerRef, edgePickIndexRef, wasDragGesture]);

  // Cluster + supercluster zoom-to-fit.
  const onClusterClick = useCallback((clusterId: string) => {
    if (wasDragGesture()) return;
    const layout = sceneStore.getState().layout;
    const rect = layout?.clusterRects?.get(clusterId)
      ?? layout?.clusters?.find(c => c.id === clusterId)?.rect;
    zoomToRect(rect);
  }, [wasDragGesture]);
  const onSuperclusterClick = useCallback((superclusterId: string) => {
    if (wasDragGesture()) return;
    const layout = sceneStore.getState().layout;
    const rect = layout?.superclusters?.find(c => c.id === superclusterId)?.rect;
    zoomToRect(rect);
  }, [wasDragGesture]);

  // HUD zoom in/out buttons.
  const onZoomIn = useCallback(
    () => zoomAt(0.25, viewportWidth / 2, viewportHeight / 2),
    [zoomAt, viewportWidth, viewportHeight],
  );
  const onZoomOut = useCallback(
    () => zoomAt(-0.25, viewportWidth / 2, viewportHeight / 2),
    [zoomAt, viewportWidth, viewportHeight],
  );

  return {
    onMouseDown,
    onMouseMove,
    onMouseUp,
    selectFile,
    hoverFile,
    hoverCluster,
    hoverSupercluster,
    onClusterClick,
    onSuperclusterClick,
    onZoomIn,
    onZoomOut,
  };
}

// Zoom-to-fit that clamps to the same bounds as useCanvasViewport.
function zoomToRect(rect: { x: number; y: number; w: number; h: number } | undefined): void {
  if (!rect) return;
  const vp = viewportStore.getState().viewport;
  if (vp.width <= 0 || vp.height <= 0 || rect.w <= 0 || rect.h <= 0) return;
  const FILL = 0.8;
  const rawScale = Math.min(vp.width / rect.w, vp.height / rect.h) * FILL;
  const scale = Math.min(2.5, Math.max(0.05, rawScale));
  const cx = rect.x + rect.w / 2;
  const cy = rect.y + rect.h / 2;
  const x = vp.width / 2 - cx * scale;
  const y = vp.height / 2 - cy * scale;
  viewportStore.setViewport({ ...vp, x, y, scale });
}
