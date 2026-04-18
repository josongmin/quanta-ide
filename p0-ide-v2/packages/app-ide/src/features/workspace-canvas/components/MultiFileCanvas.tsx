import { useRef, useCallback, useEffect, useMemo } from "react";
import "../workspace-canvas.css";
import { useWorkspaceCanvasOrchestrator } from "../hooks/use-workspace-canvas";
import { useCanvasViewport } from "../hooks/use-canvas-viewport";
import { viewportStore } from "../store/viewport-store";
import { sceneStore, useSceneStore } from "../store/scene-store";
import { interactionStore, useInteractionStore } from "../store/interaction-store";
import { settingsStore, useSettingsStore } from "../store/settings-store";
import { EdgeGeometryCache, computeNeighborhood, compileEdgeFilter, createEdgePickIndex, materializeEdgeSet, diffSnapshots } from "@quanta/canvas-engine";
import type { EdgePickIndex } from "@quanta/canvas-engine";
import { PixiStage } from "@quanta/canvas-pixi";
import type { WorkspaceGraph } from "@quanta/canvas-engine";
import { StreetCard } from "./StreetCard";
import { GroundCard } from "./GroundCard";
import { Minimap } from "./Minimap";
import { CanvasControls } from "./CanvasControls";
import { LoadingOverlay } from "./LoadingOverlay";
import { DebugHud } from "./DebugHud";
import { EvidencePanel } from "./EvidencePanel";

interface Props {
  graph: WorkspaceGraph;
}

export function MultiFileCanvas({ graph }: Props) {
  useWorkspaceCanvasOrchestrator(graph);

  const containerRef = useRef<HTMLDivElement>(null);
  const gridRef      = useRef<HTMLDivElement>(null);
  const domLayerRef  = useRef<HTMLDivElement>(null);
  const { panBy, zoomAt, fitToGraph, setContainerSize, transform, viewport } = useCanvasViewport();

  // Drag vs click disambiguation: the outer div owns pan, while Pixi emits
  // `pointertap` from the same pointerup. Without a guard, dragging a module
  // also fires a click (cluster zoom / file select) at release. We count pixel
  // movement between mousedown and the trailing click, and suppress clicks
  // that follow a real drag.
  const dragDistance = useRef(0);
  const CLICK_SLOP_PX = 5;
  const wasDragGesture = () => dragDistance.current > CLICK_SLOP_PX;

  // Shift-key tracking for the shift+click → path-query shortcut. The click
  // delivery path (PixiStage.onFileClick, StreetCard.onSelect) only carries
  // an id, not the originating MouseEvent, so we observe modifier state at
  // the window level and consult the ref when a click lands.
  const shiftHeldRef = useRef(false);
  const metaHeldRef = useRef(false);
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      shiftHeldRef.current = e.shiftKey;
      metaHeldRef.current = e.metaKey || e.ctrlKey;
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("keyup", onKey);
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("keyup", onKey);
    };
  }, []);

  const edgeClickConsumedRef = useRef(false);

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
    // Shift+click with an existing selection = (source → target) query.
    // Plain click always replaces selection and clears any prior query so
    // the user can return to normal focus-mode behaviour.
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
  }, []);
  const hoverFile = useCallback((id: string | null) => interactionStore.hoverFile(id), []);
  // Reads the current value from the settings store at click time so we
  // don't need `showEdges` in deps — keeps this callback referentially
  // stable for the CanvasControls memo boundary (and for our own render
  // budget).
  const toggleEdges = useCallback(() => {
    settingsStore.setShowEdges(!settingsStore.getState().showEdges);
  }, []);

  // Apply the pan/zoom transform imperatively rather than via `style={{transform}}`
  // props. This bypasses React reconciliation for the two hottest-changing DOM
  // nodes on the page (the grid background + DOM card layer). With 5000+ files
  // at street LOD, React reconciling a fresh style object 60×/s alone produced
  // measurable stutter.
  useEffect(() => {
    if (gridRef.current) gridRef.current.style.transform = transform;
    if (domLayerRef.current) domLayerRef.current.style.transform = transform;
  }, [transform]);
  // Fix #5: migrate hot-path selectors onto focused sub-stores so pan/zoom
  // ticks (viewport store) don't wake scene/settings subscribers, and vice
  // versa. Each field is read from the store that owns it.
  const lod               = useInteractionStore(s => s.lod);
  const visibleScene      = useSceneStore(s => s.visibleScene);
  const clusterScene      = useSceneStore(s => s.clusterScene);
  const superclusterScene = useSceneStore(s => s.superclusterScene);
  const viewState         = useInteractionStore(s => s.viewState);
  const layout            = useSceneStore(s => s.layout);
  const layoutProgress    = useSceneStore(s => s.layoutProgress);
  const showEdges         = useSettingsStore(s => s.showEdges);
  const edgeKinds         = useSettingsStore(s => s.edgeKinds);
  const edgeLayers        = useSettingsStore(s => s.edgeLayers);
  const edgeMinSeverity   = useSettingsStore(s => s.edgeMinSeverity);
  const edgeWidthMul      = useSettingsStore(s => s.edgeWidthMul);
  const focusMode         = useSettingsStore(s => s.focusMode);
  const focusHops         = useSettingsStore(s => s.focusHops);
  const focusDimOpacity   = useSettingsStore(s => s.focusDimOpacity);
  const showClusterEdges  = useSettingsStore(s => s.showClusterEdges);
  const showSccBubbles    = useSettingsStore(s => s.showSccBubbles);
  const showStartHereBadges = useSettingsStore(s => s.showStartHereBadges);
  const startHereTopN     = useSettingsStore(s => s.startHereTopN);
  const edgeFilterQuery   = useSettingsStore(s => s.edgeFilterQuery);
  const highlightArchViolations = useSettingsStore(s => s.highlightArchViolations);
  const pathQuery         = useInteractionStore(s => s.pathQuery);
  const pathResult        = useInteractionStore(s => s.pathResult);
  const temporal          = useInteractionStore(s => s.temporal);
  const edgeCacheRef = useRef(new EdgeGeometryCache());
  const edgePickIndexRef = useRef<EdgePickIndex>(createEdgePickIndex());

  // Focus target: selection wins over hover (same derivation as getFocusFileId).
  // Local derivation avoids an extra store round-trip; the inputs are already
  // subscribed above.
  const focusId = viewState.selectedFileId ?? viewState.hoveredFileId ?? null;
  // Memo keyed on graph edges + focus state so panning/zooming doesn't re-BFS.
  // BFS is O(V+E) which is cheap but rebuilding the undirected adjacency every
  // frame would be wasteful at 10k+ edges.
  const focusEdgeIds = useMemo<ReadonlySet<string> | null>(() => {
    if (focusMode !== "on" || !focusId || !graph.fileEdges) return null;
    return computeNeighborhood({ fileEdges: graph.fileEdges }, focusId, focusHops).edges;
  }, [graph.fileEdges, focusId, focusHops, focusMode]);
  // Path-query wins over selection focus. We could intersect the two, but a
  // non-empty intersection frequently collapses to a tiny set that hides the
  // query answer — path-wins keeps the user's explicit query dominant.
  const pathEdgeIds = useMemo<ReadonlySet<string> | null>(() => {
    if (!pathQuery || !pathResult || pathResult.paths.length === 0) return null;
    const out = new Set<string>();
    for (const p of pathResult.paths) for (const id of p.edgeIds) out.add(id);
    return out;
  }, [pathQuery, pathResult]);
  const edgeFocus = pathEdgeIds
    ? { edgeIds: pathEdgeIds, dimAlpha: focusDimOpacity }
    : focusEdgeIds
      ? { edgeIds: focusEdgeIds, dimAlpha: focusDimOpacity }
      : undefined;

  // Compile the live DSL query each time it changes. Memo'd on the raw
  // string so typing re-compiles at 60fps is still cheap (tokenizer + parser
  // run in single-digit microseconds on a ~40-char query).
  const edgePredicate = useMemo(() => {
    const res = compileEdgeFilter(edgeFilterQuery);
    return res.predicate;
  }, [edgeFilterQuery]);

  // Arch violations surface from layout; wrap as Set for O(1) renderer lookup.
  const edgeViolations = useMemo<ReadonlySet<string> | undefined>(() => {
    if (!highlightArchViolations) return undefined;
    const v = layout?.archViolations?.edgeIds;
    return v && v.length > 0 ? new Set(v) : undefined;
  }, [highlightArchViolations, layout?.archViolations]);

  // ── Temporal slider / diff mode ───────────────────────────────────
  // Scrubbing changes `snapshotIndex` / `diffFrom` / `diffTo`; we keep the
  // derived edge sets memoised so dragging the slider at 60fps doesn't
  // re-walk the delta chain or diff sets on every viewport tick.
  const temporalEdgeSet = useMemo<ReadonlySet<string> | undefined>(() => {
    if (temporal.mode !== "live") return undefined;
    const h = graph.history;
    if (!h || h.snapshots.length === 0) return undefined;
    return materializeEdgeSet(h, temporal.snapshotIndex);
  }, [graph.history, temporal.mode, temporal.snapshotIndex]);

  const diffSets = useMemo<{ added?: ReadonlySet<string>; removed?: ReadonlySet<string> }>(() => {
    if (temporal.mode !== "diff") return {};
    const h = graph.history;
    if (!h || h.snapshots.length === 0) return {};
    const d = diffSnapshots(h, temporal.diffFrom, temporal.diffTo);
    return { added: d.added, removed: d.removed };
  }, [graph.history, temporal.mode, temporal.diffFrom, temporal.diffTo]);

  // Live-mode auto-advance — `playing` toggles a setInterval that bumps the
  // index every 1200ms and wraps at the end. We pause when the tab is
  // backgrounded via the visibility API so a play-then-forget session
  // doesn't pin the main thread.
  useEffect(() => {
    if (temporal.mode !== "live" || !temporal.playing) return;
    const count = graph.history?.snapshots.length ?? 0;
    if (count < 2) return;
    const id = window.setInterval(() => {
      const cur = interactionStore.getState().temporal.snapshotIndex;
      interactionStore.setSnapshotIndex((cur + 1) % count);
    }, 1200);
    return () => window.clearInterval(id);
  }, [temporal.mode, temporal.playing, graph.history]);

  // Rebuild edge cache when layout changes
  useEffect(() => {
    if (!layout) return;
    edgeCacheRef.current.build(
      layout.edgeRoutes.size > 0 ? (visibleScene?.edges ?? []) : [],
      layout,
    );
    // intentionally exclude visibleScene.edges — rebuild on layout change only
  }, [layout]);

  useEffect(() => {
    if (!layout) {
      edgePickIndexRef.current.clear();
      return;
    }
    const edges = visibleScene?.edges ?? [];
    edgePickIndexRef.current.build(edges, layout);
  }, [layout, visibleScene?.edges]);

  // ResizeObserver for container size — also triggers initial fit if layout
  // already arrived while container was still 0×0 (worker is fast).
  const fittedRef = useRef(false);
  // When the graph is replaced (setGraph resets layout to null), allow a fresh
  // fit once the new layout arrives. Without this, loading a new repo would
  // leave the old graph's zoom/pan.
  useEffect(() => {
    if (!layout) fittedRef.current = false;
  }, [layout]);
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setContainerSize(r.width, r.height);
      if (!fittedRef.current && layout && r.width > 0 && r.height > 0) {
        fittedRef.current = true;
        fitToGraph(layout.totalBounds.w, layout.totalBounds.h);
      }
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, [setContainerSize, fitToGraph, layout]);

  // RAF-batched pan/zoom: trackpad wheel + mousemove can fire 100+ Hz. Each
  // event would otherwise round-trip through the store → re-render → Pixi
  // camera effect. Coalesce into one flush per animation frame (~60 fps).
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

  // Wheel handler (non-passive for preventDefault)
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      const rect = el.getBoundingClientRect();
      if (e.ctrlKey || e.metaKey) {
        // Zoom deltas accumulate too — multiple wheel ticks in one frame
        // collapse into one zoomAt call with summed delta around the last cursor.
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
  }, [scheduleFlush]);

  useEffect(() => () => {
    if (rafId.current !== null) cancelAnimationFrame(rafId.current);
  }, []);

  // Mouse drag for pan
  const dragging = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });

  const onMouseDown = useCallback((e: React.MouseEvent) => {
    if ((e.target as HTMLElement).closest("button,a,.file-card")) return;
    e.preventDefault();
    dragging.current = true;
    dragDistance.current = 0;
    lastMouse.current = { x: e.clientX, y: e.clientY };
  }, []);

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

  // Zoom controls
  const onZoomIn = useCallback(() => zoomAt(0.25, viewport.width / 2, viewport.height / 2), [zoomAt, viewport.width, viewport.height]);
  const onZoomOut = useCallback(() => zoomAt(-0.25, viewport.width / 2, viewport.height / 2), [zoomAt, viewport.width, viewport.height]);
  const onFit = useCallback(() => {
    if (layout) fitToGraph(layout.totalBounds.w, layout.totalBounds.h);
  }, [fitToGraph, layout]);

  // Container-level double-click: toggle between "zoom to selected file"
  // (or cluster) and "fit-to-graph" (fold back out). Mirrors the cluster
  // click behaviour but at the file level and with an explicit gesture so
  // plain clicks stay reserved for selection.
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onDblClick = () => {
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
  }, []);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const onMove = (e: MouseEvent) => {
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
    };
    const onClick = (e: MouseEvent) => {
      if (!(e.metaKey || e.ctrlKey)) return;
      if (wasDragGesture()) return;
      const rect = el.getBoundingClientRect();
      const vp = viewportStore.getState().viewport;
      if (vp.scale <= 0) return;
      const cx = e.clientX - rect.left;
      const cy = e.clientY - rect.top;
      const worldX = (cx - vp.x) / vp.scale;
      const worldY = (cy - vp.y) / vp.scale;
      const tol = 8 / vp.scale;
      const hit = edgePickIndexRef.current.pickAt(worldX, worldY, tol);
      if (!hit) return;
      const g = sceneStore.getState().graph;
      const proofs = g?.proofs;
      if (hit.evidenceId && proofs && proofs[hit.evidenceId]) {
        edgeClickConsumedRef.current = true;
        interactionStore.setInspectedEvidence(hit.evidenceId);
      }
    };
    el.addEventListener("mousemove", onMove);
    el.addEventListener("click", onClick, true);
    const onLeave = () => {
      if (interactionStore.getState().viewState.hoveredEdgeId !== null) {
        interactionStore.hoverEdge(null);
      }
    };
    el.addEventListener("mouseleave", onLeave);
    return () => {
      el.removeEventListener("mousemove", onMove);
      el.removeEventListener("click", onClick, true);
      el.removeEventListener("mouseleave", onLeave);
    };
  }, []);

  // Cluster click → zoom-to-fit that cluster's rect. Reads layout + viewport
  // directly from the owning sub-stores at click time so this callback stays
  // referentially stable (important: PixiStage stores the ref inside a
  // useEffect([]) init path).
  const onClusterClick = useCallback((clusterId: string) => {
    if (wasDragGesture()) return;
    const layout = sceneStore.getState().layout;
    const rect = layout?.clusterRects?.get(clusterId)
      ?? layout?.clusters?.find(c => c.id === clusterId)?.rect;
    if (!rect) return;
    const vp = viewportStore.getState().viewport;
    if (vp.width <= 0 || vp.height <= 0 || rect.w <= 0 || rect.h <= 0) return;
    // Fill ~80% of the viewport with the cluster; center it.
    const FILL = 0.8;
    const rawScale = Math.min(vp.width / rect.w, vp.height / rect.h) * FILL;
    // Clamp to the same bounds as useCanvasViewport.zoomAt (0.05..2.5).
    const scale = Math.min(2.5, Math.max(0.05, rawScale));
    const cx = rect.x + rect.w / 2;
    const cy = rect.y + rect.h / 2;
    const x = vp.width / 2 - cx * scale;
    const y = vp.height / 2 - cy * scale;
    viewportStore.setViewport({ ...vp, x, y, scale });
  }, []);

  // Supercluster click → same zoom-to-fit behavior as clusters, indexed into
  // layout.superclusters. Referentially stable so PixiStage's init-path ref
  // capture doesn't churn.
  const onSuperclusterClick = useCallback((superclusterId: string) => {
    if (wasDragGesture()) return;
    const layout = sceneStore.getState().layout;
    const rect = layout?.superclusters?.find(c => c.id === superclusterId)?.rect;
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
  }, []);

  // Show the loading overlay only when none of the three scene tiers has
  // been computed. At supergalaxy / universe LOD visibleScene is null (we
  // use clusterScene / superclusterScene instead) — either one is "ready".
  if (!visibleScene && !clusterScene && !superclusterScene) {
    return (
      <div ref={containerRef} className="workspace-canvas workspace-canvas--loading">
        <LoadingOverlay progress={layoutProgress} hasGraph={!!graph.files.length} />
      </div>
    );
  }

  return (
    <div
      ref={containerRef}
      className="workspace-canvas"
      onMouseDown={onMouseDown}
      onMouseMove={onMouseMove}
      onMouseUp={onMouseUp}
      onMouseLeave={onMouseUp}
    >
      {/* Grid dot background (moves with pan/zoom; transform applied imperatively) */}
      <div
        ref={gridRef}
        className="workspace-canvas__grid"
        style={{ transformOrigin: "0 0" }}
      />

      {/* WebGL layer: always mounted when layout ready to avoid reinit on LOD transition */}
      {layout && (
        <PixiStage
          visible={visibleScene ?? { kind: "files", files: [], edges: [], comments: [] }}
          clusters={clusterScene}
          superclusters={superclusterScene}
          layout={layout}
          viewState={viewState}
          viewport={viewport}
          lod={lod}
          edgeCache={edgeCacheRef.current}
          showEdges={showEdges}
          edgeKinds={edgeKinds}
          edgeLayers={edgeLayers}
          edgeMinSeverity={edgeMinSeverity}
          edgeWidthMul={edgeWidthMul}
          edgeFocus={edgeFocus}
          showClusterEdges={showClusterEdges}
          showSccBubbles={showSccBubbles}
          showStartHereBadges={showStartHereBadges}
          startHereTopN={startHereTopN}
          edgePredicate={edgePredicate}
          edgeViolations={edgeViolations}
          temporalEdgeSet={temporalEdgeSet}
          diffAdded={diffSets.added}
          diffRemoved={diffSets.removed}
          onFileClick={selectFile}
          onFileHover={hoverFile}
          onClusterClick={onClusterClick}
          onSuperclusterClick={onSuperclusterClick}
        />
      )}

      {/* DOM layer: Street/Ground (transform applied imperatively via domLayerRef) */}
      {(lod === "street" || lod === "ground") && visibleScene && (
        <div
          ref={domLayerRef}
          className="workspace-canvas__dom-layer"
          style={{ transformOrigin: "0 0", willChange: "transform" }}
        >
          {visibleScene.files.map(file => {
            const rect = layout?.fileRects.get(file.id);
            if (!rect) return null;
            const isSelected = viewState.selectedFileId === file.id;
            return lod === "street" ? (
              <StreetCard
                key={file.id}
                file={file}
                rect={rect}
                isSelected={isSelected}
                onSelect={selectFile}
              />
            ) : (
              <GroundCard
                key={file.id}
                file={file}
                rect={rect}
                isSelected={isSelected}
                onSelect={selectFile}
              />
            );
          })}
        </div>
      )}

      {/* Overlays */}
      <Minimap layout={layout} viewport={viewport} />
      <CanvasControls
        scale={viewport.scale}
        onZoomIn={onZoomIn}
        onZoomOut={onZoomOut}
        onFit={onFit}
        showEdges={showEdges}
        edgeCount={visibleScene?.edges.length ?? 0}
        onToggleEdges={toggleEdges}
      />
      <DebugHud />
      <EvidencePanel />
    </div>
  );
}
