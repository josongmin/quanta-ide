import {
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
  type ReactElement,
  type WheelEvent as ReactWheelEvent,
} from "react";
import {
  buildHierarchicalLayout,
  type HierarchicalLayout,
} from "@quanta/canvas-engine";
import { useTierSwitch, TierBreadcrumb } from "../../../features/tier-switch";
import { useEntityState, entityStore } from "../../../entities/entity";
import { useWorkspaceGraph } from "../../../shared/api/graph-source";
import { CanvasViewport } from "./CanvasViewport";
import { HoverTooltip } from "./HoverTooltip";
import { MindMapView, buildMindMap, mindMapStore, useMindMapState } from "../../../features/mind-map";
import { ChordView, buildChordLayout } from "../../../features/chord-view";
import { MatrixView, buildMatrixLayout } from "../../../features/matrix-view";
import { QuadrantView, buildQuadrantLayout } from "../../../features/quadrant-view";
import { ArcView, buildArcLayout } from "../../../features/arc-view";
import { EmbeddingMapView, buildEmbeddingLayout } from "../../../features/embedding-map";
import { BlastView, buildBlastLayout } from "../../../features/blast-view";
import { ArchLayerView, buildArchLayerLayout } from "../../../features/arch-layer-view";
import { DebtChartView, buildDebtChartLayout } from "../../../features/debt-chart";
import { RefactorTerrainView, buildRefactorTerrainLayout } from "../../../features/refactor-terrain";
import { CycleGenesisView } from "../../../features/cycle-genesis";
import { SmellHistoryView } from "../../../features/smell-history";
import { ArchDriftView } from "../../../features/arch-drift";
import { CoChangeView } from "../../../features/cochange";
import { RefactorSimView } from "../../../features/refactor-sim";
import { StartHereView } from "../../../features/start-here";
import { PathfinderView } from "../../../features/pathfinder";
import { NeighborhoodView } from "../../../features/neighborhood";
import { AuthorTerritoryView } from "../../../features/author-territory";
import { ServiceTopoView } from "../../../features/service-topo";
import { Galaxy3DView } from "../../../features/galaxy-3d";
import { useViewMode, viewModeStore, ViewModePicker, VIEW_MODE_OPTIONS, VIEW_GLYPH } from "../../../features/view-mode";
import { loadViewport } from "../../../shared/api/viewport-persistence";
import { LeftPanel } from "../../left-panel";
import { Inspector } from "../../inspector";
import {
  makeWeightFn,
  useLayoutWeight,
} from "../../../features/layout-weight";
import { NavHistoryButtons } from "../../../features/nav-history";
import { ColorModePicker } from "../../../features/color-mode";
import { color, font, radius, space, transition } from "../../../shared/ui/tokens";
import { IconLayoutGrid, IconSidebarLeft, IconSidebarRight } from "../../../shared/ui/icons";

// CanvasShell — top-level Code Universe widget.
//
//   ┌ header: [◧] [◀ ▶]  Code Universe  workspace/shell/…   [LoC·1.000] [File] [▤] [◨] ┐
//   ├─────────────────────────────────────────────────────────────────────────────────┤
//   │ LeftPanel  │                   CanvasViewport (Pixi)                │ Inspector │
//   │            │                                                        │           │
//   │            │             ┌─ Toolbar (tier · kind · weight) ─┐       │           │
//   │            │             └─────────────── floating ─────────┘       │           │
//   └────────────┴────────────────────────────────────────────────────────┴───────────┘
//
// Figma-style split: the top bar carries *chrome* (title, nav
// history, current-context readouts, panel toggles); working
// controls live in a floating toolbar centered over the viewport so
// they're reachable without eye-travel to a distant corner. Panel
// widths + collapsed state persist user-global.

const KEY_FACTOR = 1.2;

const LEFT_MIN = 200;
const LEFT_MAX = 480;
const LEFT_DEFAULT = 264;
const RIGHT_MIN = 260;
const RIGHT_MAX = 560;
const RIGHT_DEFAULT = 320;
const DIVIDER_W = 6;

const PREFS_KEY = "cu:panels:v1";
interface PanelPrefs {
  leftW: number;
  rightW: number;
  leftCollapsed: boolean;
  rightCollapsed: boolean;
}

function loadPrefs(): PanelPrefs {
  if (typeof localStorage === "undefined") return defaultPrefs();
  try {
    const raw = localStorage.getItem(PREFS_KEY);
    if (!raw) return defaultPrefs();
    const parsed = JSON.parse(raw) as Partial<PanelPrefs>;
    return {
      leftW: clamp(parsed.leftW ?? LEFT_DEFAULT, LEFT_MIN, LEFT_MAX),
      rightW: clamp(parsed.rightW ?? RIGHT_DEFAULT, RIGHT_MIN, RIGHT_MAX),
      leftCollapsed: parsed.leftCollapsed === true,
      rightCollapsed: parsed.rightCollapsed === true,
    };
  } catch {
    return defaultPrefs();
  }
}
function defaultPrefs(): PanelPrefs {
  return { leftW: LEFT_DEFAULT, rightW: RIGHT_DEFAULT, leftCollapsed: false, rightCollapsed: false };
}
function clamp(v: number, lo: number, hi: number): number {
  return Math.max(lo, Math.min(hi, v));
}

export interface CanvasShellProps {
  /** Pass-through from the host's TabAppDescriptor. Enables per-tab
   *  persistence of camera pose / selection. */
  tabId?: string;
}

export function CanvasShell({ tabId }: CanvasShellProps = {}): ReactElement {
  const { tier, scale, zoomBy } = useTierSwitch();
  const tree = useEntityState(s => s.tree);
  const graph = useWorkspaceGraph();

  // Treemap camera pose is read fresh on each (re-)mount of
  // CanvasViewport — switching to Mind/Galaxy and back restores the
  // last-seen pan/zoom instead of reverting to the pose at shell
  // first-mount. CanvasViewport captures this prop once in its own
  // useState initializer, so the read only matters at mount instant
  // — the wasted localStorage hits on other re-renders are trivial.

  const [prefs, setPrefs] = useState<PanelPrefs>(loadPrefs);
  useEffect(() => {
    try { localStorage.setItem(PREFS_KEY, JSON.stringify(prefs)); } catch { /* ignore */ }
  }, [prefs]);

  const weightMode = useLayoutWeight(s => s.mode);
  const layout = useMemo<HierarchicalLayout | null>(
    () =>
      tree
        ? buildHierarchicalLayout(tree, {
            weight: makeWeightFn(tree, weightMode),
            // Sibling gutter, world units. Matched to the default 24-unit
            // outer padding so a card's gap to its neighbour reads the
            // same as its gap to the parent's edge — otherwise inner
            // rows look cramped relative to the rim. Worth more at deep
            // tiers: rooms inside a small file get breathing room that
            // survives max zoom without collapsing into a sheet.
            gap: 32,
            padding: 32,
          })
        : null,
    [tree, weightMode],
  );

  const viewportRef = useRef<HTMLDivElement | null>(null);
  const [viewportSize, setViewportSize] = useState<{ w: number; h: number }>({ w: 0, h: 0 });
  useLayoutEffect(() => {
    const el = viewportRef.current;
    if (!el) return;
    const ro = new ResizeObserver(entries => {
      const r = entries[0]?.contentRect;
      if (!r) return;
      setViewportSize({ w: r.width, h: r.height });
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  // Mind-map mode — radial egocentric view of the current selection's
  // relationships. `M` toggles it; Esc closes it (entityStore Esc is
  // handled elsewhere, we intercept BEFORE it propagates). When no
  // entity is selected we fall back to the universe root so the mode
  // always has *something* to show (repo-level package mind-map). Empty
  // mind-maps read as a bug even when they're "correct" — better to
  // show the zoom-out view than a blank overlay.
  const mindMapEnabled = useMindMapState(s => s.enabled);
  const mindMapCenterId = useMindMapState(s => s.centerId);
  const viewMode = useViewMode(s => s.mode);
  const selectedId = useEntityState(s => s.interaction.selectedId);
  const [blastDirection, setBlastDirection] = useState<"blast" | "fix">("blast");

  // Resolve the current mind-map focus: prefer the selection, fall back
  // to the universe root. Read both from the respective stores at call
  // time so we don't re-register the handler on every selection tick.
  const resolveMindMapFocus = useCallback((): string | null => {
    const sel = entityStore.getState().interaction.selectedId;
    if (sel) return sel;
    return tree?.rootId ?? null;
  }, [tree]);
  const onKeyDown = useCallback(
    (e: React.KeyboardEvent<HTMLDivElement>) => {
      const target = e.target as HTMLElement | null;
      const inField = !!target && (target.tagName === "INPUT" || target.tagName === "TEXTAREA" || target.isContentEditable);
      if ((e.key === "v" || e.key === "V") && !e.ctrlKey && !e.metaKey && !e.altKey && !inField) {
        e.preventDefault();
        viewModeStore.cycle();
        const next = viewModeStore.getState().mode;
        // Cycle landed on mindmap — raise the overlay on the current
        // selection (or silently move past if there's nothing picked).
        // Other modes close the overlay so the underlying canvas shows.
        if (next === "mindmap") {
          const focus = resolveMindMapFocus();
          if (focus) mindMapStore.openOn(focus);
        } else {
          mindMapStore.close();
        }
        return;
      }
      if (e.key === "m" || e.key === "M") {
        if (e.ctrlKey || e.metaKey || e.altKey) return; // leave OS shortcuts alone
        if (inField) return;
        e.preventDefault();
        const focus = resolveMindMapFocus();
        mindMapStore.toggle(focus);
        // Keep the view-mode store in sync — if mindmap is now open,
        // flip the segmented control to match so the user sees which
        // mode is active.
        const stillOpen = mindMapStore.getState().enabled;
        // M opens mindmap → sync the picker. M closes → restore treemap only
        // if mindmap was the active mode; otherwise leave the current mode alone.
        if (stillOpen) {
          viewModeStore.setMode("mindmap");
        } else if (viewModeStore.getState().mode === "mindmap") {
          viewModeStore.setMode("treemap");
        }
        return;
      }
      if (e.key === "Escape") {
        const current = viewModeStore.getState().mode;
        if (current !== "treemap") {
          e.preventDefault();
          if (mindMapEnabled) mindMapStore.close();
          viewModeStore.setMode("treemap");
          return;
        }
      }
      if (!(e.ctrlKey || e.metaKey)) return;
      if (e.key === "+" || e.key === "=") {
        e.preventDefault();
        zoomBy(KEY_FACTOR);
      } else if (e.key === "-" || e.key === "_") {
        e.preventDefault();
        zoomBy(1 / KEY_FACTOR);
      }
    },
    [zoomBy, mindMapEnabled, resolveMindMapFocus],
  );
  const onSwallowReactWheel = useCallback((e: ReactWheelEvent<HTMLDivElement>) => {
    if (e.ctrlKey || e.metaKey) return;
  }, []);

  // Build the mind-map graph lazily — only when the mode is active AND
  // we have tree + graph + a viewport size. The builder is pure-data;
  // `useMemo` keyed on (centre, tree, graph, viewport dims) keeps it
  // stable across unrelated re-renders (pan, hover, etc.).
  const mindMapGraph = useMemo(() => {
    if (!mindMapEnabled || !mindMapCenterId) return null;
    if (!tree || !graph) return null;
    if (viewportSize.w <= 0 || viewportSize.h <= 0) return null;
    try {
      return buildMindMap({
        tree,
        graph,
        centerId: mindMapCenterId,
        width: viewportSize.w,
        height: viewportSize.h,
      });
    } catch {
      // Centre id no longer in the tree (e.g. workspace reload) — close
      // the view instead of hanging on an invalid graph. The user can
      // re-open on a fresh selection.
      mindMapStore.close();
      return null;
    }
  }, [mindMapEnabled, mindMapCenterId, tree, graph, viewportSize.w, viewportSize.h]);

  // Chord layout — only built when chord view is actually selected,
  // to avoid paying the hierarchical-edge-bundling cost on every
  // workspace load. Defaults to galaxy-level leaves = PACKAGE COUPLING
  // view (10–30 packages arc'd on the ring with rolled-up file import
  // ribbons between them). This is the useful starting point; file-
  // level chord is only meaningful when scoped into one package and
  // is accessed by a future "Chord inside this package" question.
  const chordLayout = useMemo(() => {
    if (viewMode !== "chord") return null;
    if (!tree || !graph) return null;
    if (viewportSize.w <= 0 || viewportSize.h <= 0) return null;
    try {
      return buildChordLayout({
        tree,
        graph,
        width: viewportSize.w,
        height: viewportSize.h,
        // Explicit for clarity — also the current builder default.
        leafKind: "galaxy",
      });
    } catch {
      return null;
    }
  }, [viewMode, tree, graph, viewportSize.w, viewportSize.h]);

  // Matrix layout — lazy for the same reasons as chord. Default
  // `rowKind: "building"` at workspace scope would dump ~1000 rows;
  // cap with `maxRows: 120` and let the connectivity rank keep the
  // most interesting files. Power users can scope into a package via
  // the Analyze panel's future "Matrix inside this" action.
  const matrixLayout = useMemo(() => {
    if (viewMode !== "matrix") return null;
    if (!tree || !graph) return null;
    if (viewportSize.w <= 0 || viewportSize.h <= 0) return null;
    try {
      return buildMatrixLayout({
        tree,
        graph,
        width: viewportSize.w,
        height: viewportSize.h,
        // Package-level DSM at workspace scope — ~20-30 rows with
        // clear block structure. File-level DSM (`rowKind: "building"`)
        // is only meaningful when scoped into one package; a future
        // "Matrix inside this package" Analyze question will flip into
        // that mode with an explicit scopeId.
        rowKind: "galaxy",
        maxRows: 60,
      });
    } catch {
      return null;
    }
  }, [viewMode, tree, graph, viewportSize.w, viewportSize.h]);

  const quadrantLayout = useMemo(() => {
    if (viewMode !== "quadrant") return null;
    if (!tree || !graph) return null;
    if (viewportSize.w <= 0 || viewportSize.h <= 0) return null;
    try {
      return buildQuadrantLayout({ tree, graph, width: viewportSize.w, height: viewportSize.h, pointKind: "galaxy" });
    } catch { return null; }
  }, [viewMode, tree, graph, viewportSize.w, viewportSize.h]);

  const arcLayout = useMemo(() => {
    if (viewMode !== "arc-cycles") return null;
    if (!tree || !graph) return null;
    if (viewportSize.w <= 0 || viewportSize.h <= 0) return null;
    try {
      return buildArcLayout({ tree, graph, width: viewportSize.w, height: viewportSize.h, nodeKind: "galaxy" });
    } catch { return null; }
  }, [viewMode, tree, graph, viewportSize.w, viewportSize.h]);

  const embeddingLayout = useMemo(() => {
    if (viewMode !== "embedding") return null;
    if (!tree || !graph) return null;
    if (viewportSize.w <= 0 || viewportSize.h <= 0) return null;
    try {
      return buildEmbeddingLayout({ tree, graph, width: viewportSize.w, height: viewportSize.h });
    } catch { return null; }
  }, [viewMode, tree, graph, viewportSize.w, viewportSize.h]);

  const blastLayout = useMemo(() => {
    if (viewMode !== "blast") return null;
    if (!tree || !graph) return null;
    if (!selectedId) return null;
    if (viewportSize.w <= 0 || viewportSize.h <= 0) return null;
    try {
      return buildBlastLayout({ tree, graph, width: viewportSize.w, height: viewportSize.h, centerId: selectedId, direction: blastDirection });
    } catch { return null; }
  }, [viewMode, tree, graph, selectedId, blastDirection, viewportSize.w, viewportSize.h]);

  const archLayerLayout = useMemo(() => {
    if (viewMode !== "arch-layers") return null;
    if (!graph) return null;
    if (viewportSize.w <= 0 || viewportSize.h <= 0) return null;
    try {
      return buildArchLayerLayout({ graph, width: viewportSize.w, height: viewportSize.h });
    } catch { return null; }
  }, [viewMode, graph, viewportSize.w, viewportSize.h]);

  const debtChartLayout = useMemo(() => {
    if (viewMode !== "debt-history") return null;
    if (!graph) return null;
    if (viewportSize.w <= 0 || viewportSize.h <= 0) return null;
    try {
      return buildDebtChartLayout({ graph, width: viewportSize.w, height: viewportSize.h });
    } catch { return null; }
  }, [viewMode, graph, viewportSize.w, viewportSize.h]);

  const refactorTerrainLayout = useMemo(() => {
    if (viewMode !== "refactor-terrain") return null;
    if (!tree || !graph) return null;
    if (viewportSize.w <= 0 || viewportSize.h <= 0) return null;
    try {
      return buildRefactorTerrainLayout({ tree, graph });
    } catch { return null; }
  }, [viewMode, tree, graph, viewportSize.w, viewportSize.h]);

  const onDragLeft = useDividerDrag(
    prefs.leftW,
    LEFT_MIN,
    LEFT_MAX,
    +1,
    next => setPrefs(p => ({ ...p, leftW: next })),
  );
  const onDragRight = useDividerDrag(
    prefs.rightW,
    RIGHT_MIN,
    RIGHT_MAX,
    -1,
    next => setPrefs(p => ({ ...p, rightW: next })),
  );

  return (
    <div data-product="code-universe" style={ROOT_STYLE}>
      <header style={HEADER_STYLE}>
        <div style={HEADER_GROUP}>
          <IconToggle
            onClick={() => setPrefs(p => ({ ...p, leftCollapsed: !p.leftCollapsed }))}
            active={!prefs.leftCollapsed}
            title={prefs.leftCollapsed ? "Show sidebar" : "Hide sidebar"}
            ariaLabel="Toggle sidebar"
          >
            <IconSidebarLeft size={16} />
          </IconToggle>
          <NavHistoryButtons />
          <span style={PRODUCT_NAME}>Code Universe</span>
        </div>

        <div style={HEADER_MIDDLE}>
          <SelectedPath />
        </div>

        {/* Right cluster: shell chrome only (color mode + inspector
            toggle). Code-Universe-specific controls (view mode, tier,
            scale, kind) live in the floating overlay inside the
            viewport below. */}
        <div style={HEADER_GROUP}>
          <ColorModePicker />
          <IconToggle
            onClick={() => setPrefs(p => ({ ...p, rightCollapsed: !p.rightCollapsed }))}
            active={!prefs.rightCollapsed}
            title={prefs.rightCollapsed ? "Show inspector" : "Hide inspector"}
            ariaLabel="Toggle inspector"
          >
            <IconSidebarRight size={16} />
          </IconToggle>
        </div>
      </header>

      <div style={{ flex: 1, minHeight: 0, display: "flex", background: color.bg0 }}>
        {prefs.leftCollapsed ? null : (
          <>
            <div style={{ width: prefs.leftW, flexShrink: 0, height: "100%" }}>
              <LeftPanel />
            </div>
            <Divider onPointerDown={onDragLeft} />
          </>
        )}

        <div
          ref={viewportRef}
          role="region"
          aria-label="Code Universe viewport"
          tabIndex={0}
          onKeyDown={onKeyDown}
          onWheel={onSwallowReactWheel}
          style={{
            flex: 1,
            minWidth: 0,
            position: "relative",
            outline: "none",
            background: color.bg0,
          }}
        >
          {/* Code-Universe context bar — floating top-center overlay.
              Carries tier / scale / kind, which ONLY make sense in the
              treemap (Code Universe) view — zoom tier and visible-kind
              are treemap-tier artefacts. Other view modes (galaxy /
              mind / chord / …) own their own spatial language and
              don't read tier/scale. Wrapper is pointer-events: none so
              drag-pan flows through the gaps; individual controls opt
              back in. */}
          {viewMode === "treemap" ? (
            <div style={FLOATING_CONTEXT_BAR} role="toolbar" aria-label="Code Universe controls">
              <span style={FLOATING_GROUP}>
                <TierBreadcrumb />
              </span>
              <span style={FLOATING_DIVIDER} aria-hidden />
              <span style={{ ...SCALE_CHIP, ...FLOATING_GROUP_INLINE }}>
                <span style={{ color: color.text2 }}>scale</span>
                <span style={{ fontVariantNumeric: "tabular-nums", color: color.text0, fontWeight: font.weight.semibold }}>
                  {scale.toFixed(2)}
                </span>
              </span>
              <span style={{ ...KIND_CHIP, ...FLOATING_GROUP_INLINE }}>{tier.visibleKind}</span>
            </div>
          ) : null}

          {/* View-mode switcher — icon button at top-right of the
              viewport. Opens the ViewModePicker popup below itself,
              anchored to the right edge. */}
          <div style={VIEW_MODE_TRIGGER_WRAP}>
            <ViewModeDropdown />
          </div>

          {/* Universe (Pixi treemap) is the *base* view — only mount it
              when the user is actually looking at it. Other view modes
              (mind / galaxy / chord / …) cover the whole viewport, so
              keeping the treemap alive underneath just burns GPU ticker
              work + traps stray pointer/keyboard events. Unmounting
              tears down the Pixi app; camera pose is restored from
              `initialCamera` (loadViewport(tabId)) on re-mount. */}
          {viewMode === "treemap" && tree && layout && graph ? (
            <CanvasViewport
              tree={tree}
              layout={layout}
              tier={tier}
              graph={graph}
              width={viewportSize.w}
              height={viewportSize.h}
              tabId={tabId}
              initialCamera={(() => {
                const saved = loadViewport(tabId);
                return saved ? { tx: saved.tx, ty: saved.ty, scale: saved.scale } : undefined;
              })()}
            />
          ) : null}
          {viewMode === "treemap" && (!tree || !layout || !graph) ? (
            <div style={LOADING_STYLE}>
              <span style={{ opacity: 0.5 }}>·</span>
              <span>waiting for workspace graph</span>
              <span style={{ opacity: 0.5 }}>·</span>
            </div>
          ) : null}
          {mindMapEnabled && mindMapGraph ? (
            <div
              style={{
                position: "absolute",
                inset: 0,
                // Opaque-ish backdrop so the treemap underneath fades
                // out without fully disappearing — gives a sense of
                // "this is a focused layer, not a different page".
                background: "rgba(248, 250, 252, 0.94)",
                backdropFilter: "blur(6px)",
                WebkitBackdropFilter: "blur(6px)",
                zIndex: 6,
                display: "flex",
                alignItems: "stretch",
                justifyContent: "stretch",
              }}
            >
              <MindMapView
                graph={mindMapGraph}
                width={viewportSize.w}
                height={viewportSize.h}
                onFocusEntity={id => {
                  entityStore.selectEntity(id);
                  mindMapStore.openOn(id);
                }}
                onDismiss={() => mindMapStore.close()}
              />
            </div>
          ) : null}
          {viewMode === "chord" && chordLayout ? (
            <div style={OVERLAY_STYLE}>
              <ChordView
                layout={chordLayout}
                width={viewportSize.w}
                height={viewportSize.h}
                onFocusEntity={id => {
                  entityStore.selectEntity(id);
                  // Clicking a leaf in the chord view jumps to the
                  // mind-map on that entity — lets the user pivot from
                  // "overall coupling" into "who touches this one".
                  mindMapStore.openOn(id);
                  viewModeStore.setMode("mindmap");
                }}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "matrix" && matrixLayout ? (
            <div style={OVERLAY_STYLE}>
              <MatrixView
                layout={matrixLayout}
                width={viewportSize.w}
                height={viewportSize.h}
                onFocusEntity={id => {
                  entityStore.selectEntity(id);
                  mindMapStore.openOn(id);
                  viewModeStore.setMode("mindmap");
                }}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "quadrant" && quadrantLayout ? (
            <div style={OVERLAY_STYLE}>
              <QuadrantView
                layout={quadrantLayout}
                width={viewportSize.w}
                height={viewportSize.h}
                onFocusEntity={id => { entityStore.selectEntity(id); mindMapStore.openOn(id); viewModeStore.setMode("mindmap"); }}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "arc-cycles" && arcLayout ? (
            <div style={OVERLAY_STYLE}>
              <ArcView
                layout={arcLayout}
                width={viewportSize.w}
                height={viewportSize.h}
                onFocusEntity={id => { entityStore.selectEntity(id); viewModeStore.setMode("mindmap"); mindMapStore.openOn(id); }}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "embedding" && embeddingLayout ? (
            <div style={OVERLAY_STYLE}>
              <EmbeddingMapView
                layout={embeddingLayout}
                width={viewportSize.w}
                height={viewportSize.h}
                onFocusEntity={id => { entityStore.selectEntity(id); mindMapStore.openOn(id); viewModeStore.setMode("mindmap"); }}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "blast" && blastLayout ? (
            <div style={OVERLAY_STYLE}>
              <BlastView
                layout={blastLayout}
                width={viewportSize.w}
                height={viewportSize.h}
                onFocusEntity={id => { entityStore.selectEntity(id); mindMapStore.openOn(id); viewModeStore.setMode("mindmap"); }}
                onToggleDirection={() => setBlastDirection(d => d === "blast" ? "fix" : "blast")}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "arch-layers" && archLayerLayout ? (
            <div style={OVERLAY_STYLE}>
              <ArchLayerView
                layout={archLayerLayout}
                width={viewportSize.w}
                height={viewportSize.h}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "debt-history" && debtChartLayout ? (
            <div style={OVERLAY_STYLE}>
              <DebtChartView
                layout={debtChartLayout}
                width={viewportSize.w}
                height={viewportSize.h}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "refactor-terrain" && refactorTerrainLayout ? (
            <div style={OVERLAY_STYLE}>
              <RefactorTerrainView
                layout={refactorTerrainLayout}
                width={viewportSize.w}
                height={viewportSize.h}
                onFocusEntity={id => { entityStore.selectEntity(id); mindMapStore.openOn(id); viewModeStore.setMode("mindmap"); }}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "cycle-genesis" && graph ? (
            <div style={OVERLAY_STYLE}>
              <CycleGenesisView
                graph={graph}
                onFocusEntity={id => { entityStore.selectEntity(id); mindMapStore.openOn(id); viewModeStore.setMode("mindmap"); }}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "smell-history" && graph ? (
            <div style={OVERLAY_STYLE}>
              <SmellHistoryView
                graph={graph}
                onFocusEntity={id => { entityStore.selectEntity(id); mindMapStore.openOn(id); viewModeStore.setMode("mindmap"); }}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "arch-drift" && graph ? (
            <div style={OVERLAY_STYLE}>
              <ArchDriftView
                graph={graph}
                onFocusEntity={id => { entityStore.selectEntity(id); mindMapStore.openOn(id); viewModeStore.setMode("mindmap"); }}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "cochange" && graph ? (
            <div style={OVERLAY_STYLE}>
              <CoChangeView
                graph={graph}
                onFocusEntity={id => { entityStore.selectEntity(id); mindMapStore.openOn(id); viewModeStore.setMode("mindmap"); }}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "refactor-sim" && graph ? (
            <div style={OVERLAY_STYLE}>
              <RefactorSimView
                graph={graph}
                onFocusEntity={id => { entityStore.selectEntity(id); mindMapStore.openOn(id); viewModeStore.setMode("mindmap"); }}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "start-here" && graph ? (
            <div style={OVERLAY_STYLE}>
              <StartHereView
                graph={graph}
                onFocusEntity={id => { entityStore.selectEntity(id); mindMapStore.openOn(id); viewModeStore.setMode("mindmap"); }}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "pathfinder" && graph ? (
            <div style={OVERLAY_STYLE}>
              <PathfinderView
                graph={graph}
                selectedId={selectedId ?? undefined}
                onFocusEntity={id => { entityStore.selectEntity(id); mindMapStore.openOn(id); viewModeStore.setMode("mindmap"); }}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "neighborhood" && graph ? (
            <div style={OVERLAY_STYLE}>
              <NeighborhoodView
                graph={graph}
                selectedId={selectedId ?? undefined}
                onFocusEntity={id => { entityStore.selectEntity(id); viewModeStore.setMode("neighborhood"); }}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "author-territory" && graph ? (
            <div style={OVERLAY_STYLE}>
              <AuthorTerritoryView
                graph={graph}
                onFocusEntity={id => { entityStore.selectEntity(id); mindMapStore.openOn(id); viewModeStore.setMode("mindmap"); }}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "service-topo" && graph ? (
            <div style={OVERLAY_STYLE}>
              <ServiceTopoView
                graph={graph}
                onFocusEntity={id => { entityStore.selectEntity(id); mindMapStore.openOn(id); viewModeStore.setMode("mindmap"); }}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
          {viewMode === "galaxy-3d" && graph ? (
            <div style={OVERLAY_STYLE}>
              <Galaxy3DView
                graph={graph}
                selectedId={selectedId ?? undefined}
                onFocusEntity={id => { entityStore.selectEntity(id); viewModeStore.setMode("galaxy-3d"); }}
                onDismiss={() => entityStore.selectEntity(null)}
              />
            </div>
          ) : null}
        </div>

        {prefs.rightCollapsed ? null : (
          <>
            <Divider onPointerDown={onDragRight} />
            <div
              style={{
                width: prefs.rightW,
                flexShrink: 0,
                height: "100%",
                background: color.bg1,
              }}
            >
              <Inspector />
            </div>
          </>
        )}
      </div>

      <HoverTooltip />
    </div>
  );
}

function IconToggle({
  onClick,
  active,
  title,
  ariaLabel,
  children,
}: {
  onClick: () => void;
  active: boolean;
  title: string;
  ariaLabel: string;
  children: ReactElement;
}): ReactElement {
  return (
    <button
      type="button"
      onClick={onClick}
      title={title}
      aria-label={ariaLabel}
      aria-pressed={active}
      style={{
        width: 24,
        height: 24,
        border: "1px solid transparent",
        background: active ? color.bg3 : "transparent",
        color: active ? color.text0 : color.text2,
        borderRadius: radius.sm,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        justifyContent: "center",
        flexShrink: 0,
        transition: `background ${transition.fast}, color ${transition.fast}`,
      }}
      onMouseEnter={e => {
        if (!active) e.currentTarget.style.background = color.hover;
      }}
      onMouseLeave={e => {
        if (!active) e.currentTarget.style.background = "transparent";
      }}
    >
      {children}
    </button>
  );
}

function Divider({
  onPointerDown,
}: {
  onPointerDown: (e: React.PointerEvent<HTMLDivElement>) => void;
}): ReactElement {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      style={DIVIDER_STYLE}
      onMouseEnter={e => {
        const line = e.currentTarget.firstElementChild as HTMLElement | null;
        if (line) line.style.background = color.accent;
      }}
      onMouseLeave={e => {
        const line = e.currentTarget.firstElementChild as HTMLElement | null;
        if (line) line.style.background = color.border;
      }}
    >
      <span style={DIVIDER_LINE} />
    </div>
  );
}

function useDividerDrag(
  current: number,
  min: number,
  max: number,
  sign: 1 | -1,
  onChange: (next: number) => void,
): (e: React.PointerEvent<HTMLDivElement>) => void {
  const stateRef = useRef({ startX: 0, startW: current });
  stateRef.current.startW = current;

  return useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      e.preventDefault();
      stateRef.current.startX = e.clientX;
      const el = e.currentTarget;
      try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
      const onMove = (ev: PointerEvent) => {
        const dx = (ev.clientX - stateRef.current.startX) * sign;
        onChange(clamp(stateRef.current.startW + dx, min, max));
      };
      const onUp = (ev: PointerEvent) => {
        el.removeEventListener("pointermove", onMove);
        el.removeEventListener("pointerup", onUp);
        el.removeEventListener("pointercancel", onUp);
        try { el.releasePointerCapture(ev.pointerId); } catch { /* ignore */ }
      };
      el.addEventListener("pointermove", onMove);
      el.addEventListener("pointerup", onUp);
      el.addEventListener("pointercancel", onUp);
    },
    [min, max, sign, onChange],
  );
}

const ROOT_STYLE: CSSProperties = {
  position: "relative",
  width: "100%",
  height: "100%",
  display: "flex",
  flexDirection: "column",
  fontFamily: font.family,
  background: color.bg0,
  color: color.text0,
};

const HEADER_STYLE: CSSProperties = {
  padding: `0 ${space[3]}px`,
  borderBottom: `1px solid ${color.border}`,
  display: "flex",
  alignItems: "center",
  gap: space[2],
  background: color.bg1,
  flexShrink: 0,
  height: 34,
};

const HEADER_GROUP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: space[1],
  flexShrink: 0,
};

const HEADER_MIDDLE: CSSProperties = {
  flex: 1,
  minWidth: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "flex-start",
  paddingInline: space[3],
  overflow: "hidden",
};

const PATH_MONO: CSSProperties = {
  fontFamily: font.mono,
  fontSize: font.size.sm,
  color: color.text1,
  letterSpacing: -0.1,
  overflow: "hidden",
  textOverflow: "ellipsis",
  whiteSpace: "nowrap",
  maxWidth: "100%",
};

const PATH_MUTED: CSSProperties = {
  ...PATH_MONO,
  color: color.text3,
  fontStyle: "italic",
};

const PATH_SEP: CSSProperties = {
  color: color.text3,
  padding: "0 4px",
};

const PATH_LEAF: CSSProperties = {
  color: color.text0,
  fontWeight: font.weight.semibold,
};

const PATH_KIND_PILL: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: "1px 6px",
  marginRight: space[2],
  fontFamily: font.family,
  fontSize: 10,
  fontWeight: font.weight.semibold,
  letterSpacing: 0.3,
  textTransform: "uppercase",
  color: color.text2,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  flexShrink: 0,
};

const PRODUCT_NAME: CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  color: color.text0,
  letterSpacing: -0.2,
  paddingLeft: space[1],
  paddingRight: space[1],
  whiteSpace: "nowrap",
};

const SCALE_CHIP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 4,
  padding: `2px ${space[2]}px`,
  background: color.bg2,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  fontSize: font.size.sm,
  fontFamily: font.mono,
  fontVariantNumeric: "tabular-nums",
  whiteSpace: "nowrap",
};

const KIND_CHIP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  padding: `2px ${space[2]}px`,
  background: color.bg2,
  color: color.text0,
  border: `1px solid ${color.border}`,
  borderRadius: radius.sm,
  fontSize: font.size.sm,
  fontWeight: font.weight.medium,
  fontFamily: font.mono,
  letterSpacing: font.letter.tight,
  whiteSpace: "nowrap",
};

const DIVIDER_STYLE: CSSProperties = {
  width: DIVIDER_W,
  flexShrink: 0,
  cursor: "col-resize",
  position: "relative",
  background: "transparent",
  display: "flex",
  justifyContent: "center",
};

const DIVIDER_LINE: CSSProperties = {
  display: "block",
  width: 1,
  height: "100%",
  background: color.border,
  transition: `background ${transition.fast}`,
};

const OVERLAY_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  background: "rgba(248, 250, 252, 0.96)",
  backdropFilter: "blur(6px)",
  WebkitBackdropFilter: "blur(6px)",
  zIndex: 6,
  display: "flex",
  alignItems: "stretch",
  justifyContent: "stretch",
};

const LOADING_STYLE: CSSProperties = {
  position: "absolute",
  inset: 0,
  display: "flex",
  alignItems: "center",
  justifyContent: "center",
  gap: space[2],
  color: color.text2,
  fontSize: font.size.md,
  fontStyle: "italic",
  letterSpacing: font.letter.wide,
};

const FLOATING_CONTEXT_BAR: CSSProperties = {
  position: "absolute",
  top: 12,
  left: "50%",
  transform: "translateX(-50%)",
  display: "inline-flex",
  alignItems: "center",
  gap: space[2],
  padding: `${space[1]}px ${space[2]}px`,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.pill,
  boxShadow: [
    "0 1px 2px rgba(0, 0, 0, 0.04)",
    "0 10px 28px rgba(0, 0, 0, 0.08)",
  ].join(", "),
  zIndex: 10,
  pointerEvents: "none",
};

const FLOATING_GROUP: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  pointerEvents: "auto",
};

const FLOATING_GROUP_INLINE: CSSProperties = {
  pointerEvents: "auto",
};

const FLOATING_DIVIDER: CSSProperties = {
  width: 1,
  height: 20,
  alignSelf: "center",
  background: color.border,
  opacity: 0.7,
};

// Icon-button trigger for the view-mode dropdown. Sits top-right of
// the canvas viewport — square, glass-pill styled to match the
// floating context bar so the two read as part of one system.
const VIEW_MODE_TRIGGER_WRAP: CSSProperties = {
  position: "absolute",
  top: 12,
  right: 12,
  zIndex: 11,
};

const VIEW_MODE_ICON_BTN: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  gap: 7,
  height: 30,
  padding: "0 9px 0 8px",
  color: color.text1,
  background: color.bg1,
  border: `1px solid ${color.border}`,
  borderRadius: radius.md,
  cursor: "pointer",
  fontFamily: font.sans,
  boxShadow: [
    "0 1px 2px rgba(0, 0, 0, 0.04)",
    "0 10px 28px rgba(0, 0, 0, 0.08)",
  ].join(", "),
  transition: `background ${transition.fast}, color ${transition.fast}, border-color ${transition.fast}`,
};

const VIEW_MODE_BTN_ICON_SLOT: CSSProperties = {
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  // Pinned color so the grid glyph stays a neutral "handle" instead of
  // tracking the button's color on hover / open (was going near-black).
  color: color.text2,
};

const VIEW_MODE_BTN_GLYPH: CSSProperties = {
  fontSize: 14,
  lineHeight: 1,
  color: color.accent,
  fontWeight: font.weight.semibold,
};

const VIEW_MODE_BTN_LABEL: CSSProperties = {
  fontSize: font.size.md,
  fontWeight: font.weight.semibold,
  letterSpacing: font.letter.tight,
  color: color.text0,
  lineHeight: 1,
};

const VIEW_MODE_BTN_CHEVRON: CSSProperties = {
  fontSize: 9,
  color: color.text3,
  marginLeft: 2,
  fontFamily: font.sans,
  lineHeight: 1,
};

const VIEW_MODE_ICON_BTN_OPEN: CSSProperties = {
  ...VIEW_MODE_ICON_BTN,
  background: color.selected,
  color: color.text0,
  borderColor: color.borderStrong,
};

// ViewModePicker owns its own card chrome (symtip-style border + shadow)
// so the dropdown wrapper only needs to position + lift it. Padding/
// background/border would double up and clash.
const VIEW_MODE_POPUP_STYLE: CSSProperties = {
  position: "absolute",
  top: "100%",
  right: 0,
  marginTop: 4,
  zIndex: 20,
};

// SelectedPath — shows the full path of the currently anchored/selected
// entity in the shell header. Shell chrome should say *what* you are
// looking at; view-mode/tier/scale chips belong to the Code Universe
// content area and moved to the floating overlay below.
function SelectedPath(): ReactElement {
  const selectedId = useEntityState(s => s.interaction.selectedId);
  const anchorId   = useEntityState(s => s.interaction.anchorId);
  const tree       = useEntityState(s => s.tree);

  const contextId = anchorId ?? selectedId;
  const entity = contextId ? tree?.byId.get(contextId) : undefined;

  if (!entity) {
    return (
      <span style={PATH_MUTED} title="No selection — Workspace root">
        Workspace · 파일을 선택하세요
      </span>
    );
  }

  const rawPath = entity.path || entity.name;
  const parts = rawPath.split("/").filter(Boolean);
  const leaf = parts.length > 0 ? parts[parts.length - 1] : rawPath;
  const head = parts.slice(0, -1);

  return (
    <span style={PATH_MONO} title={rawPath}>
      <span style={PATH_KIND_PILL}>{entity.kind}</span>
      {head.map((seg, i) => (
        <span key={i}>
          <span>{seg}</span>
          <span style={PATH_SEP}>/</span>
        </span>
      ))}
      <span style={PATH_LEAF}>{leaf}</span>
    </span>
  );
}

function ViewModeDropdown(): ReactElement {
  const mode = useViewMode(s => s.mode);
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const prevMode = useRef(mode);
  useEffect(() => {
    if (prevMode.current !== mode) {
      prevMode.current = mode;
      setOpen(false);
    }
  }, [mode]);

  useEffect(() => {
    if (!open) return;
    const closeOnOutside = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    // Close on wheel only when the scroll happens OUTSIDE the popup.
    // Scrolling inside the picker itself (long list of modes) must not
    // dismiss it — but scroll-to-zoom on the canvas should.
    const closeOnWheel = (e: WheelEvent) => {
      if (ref.current && ref.current.contains(e.target as Node)) return;
      setOpen(false);
    };
    document.addEventListener("mousedown", closeOnOutside);
    document.addEventListener("wheel", closeOnWheel, { capture: true, passive: true });
    return () => {
      document.removeEventListener("mousedown", closeOnOutside);
      document.removeEventListener("wheel", closeOnWheel, { capture: true });
    };
  }, [open]);

  const label = VIEW_MODE_OPTIONS.find(o => o.value === mode)?.label ?? "Universe";

  return (
    <div ref={ref} style={{ position: "relative" }}>
      <button
        type="button"
        onClick={() => setOpen(v => !v)}
        aria-expanded={open}
        aria-haspopup="listbox"
        aria-label={`Switch visualization mode (current: ${label})`}
        title={`View mode · ${label}`}
        style={open ? VIEW_MODE_ICON_BTN_OPEN : VIEW_MODE_ICON_BTN}
        onMouseEnter={e => {
          if (!open) {
            e.currentTarget.style.borderColor = color.borderStrong;
          }
        }}
        onMouseLeave={e => {
          if (!open) {
            e.currentTarget.style.borderColor = color.border;
          }
        }}
      >
        <span style={VIEW_MODE_BTN_ICON_SLOT}>
          <IconLayoutGrid size={14} />
        </span>
        <span style={VIEW_MODE_BTN_GLYPH}>{VIEW_GLYPH[mode]}</span>
        <span style={VIEW_MODE_BTN_LABEL}>{label}</span>
        <span style={VIEW_MODE_BTN_CHEVRON}>▾</span>
      </button>
      {open && (
        <div style={VIEW_MODE_POPUP_STYLE}>
          <ViewModePicker />
        </div>
      )}
    </div>
  );
}
