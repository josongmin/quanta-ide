import { useEffect } from "react";
import type { MutableRefObject, RefObject } from "react";
import type { LodLevel, Viewport, WorkspaceGraph, WorkspaceLayout } from "@quanta/canvas-engine";
import { StickiesLayer } from "./StickiesLayer";
import { EdgeHighlightLayer } from "./EdgeHighlightLayer";
import { ImagesLayer } from "./ImagesLayer";
import { CollabLayer } from "./CollabLayer";
import { AnnotationsLayer } from "./AnnotationsLayer";
import { ReviewLayer } from "./ReviewLayer";
import { TicketsLayer } from "./TicketsLayer";
import { SlackThreadsLayer } from "./SlackThreadsLayer";
import { FigmaTopBar } from "./FigmaTopBar";
import { FigmaLeftRail } from "./FigmaLeftRail";
import { FigmaRightInspector } from "./FigmaRightInspector";
import { ConstellationView } from "./ConstellationView";
import { UniverseDomainPane } from "./UniverseDomainPane";
import { RoomFlowPanel } from "./RoomFlowPanel";
import { InvestigationBoard } from "./InvestigationBoard";
import { PathPlaybackBar } from "./PathPlaybackBar";
import "../figma-shell.css";
import { PrBadgesLayer } from "./PrBadgesLayer";
import { AnomalyBadgesLayer } from "./AnomalyBadgesLayer";
import { Minimap } from "./Minimap";
import { CanvasControls } from "./CanvasControls";
import { AnnotationToolbar } from "./AnnotationToolbar";
import { PagesTabBar } from "./PagesTabBar";
import { BookmarksDrawer } from "./BookmarksDrawer";
import { StoryboardPlayer } from "./StoryboardPlayer";
import { LassoOverlay, BulkActionsToolbar } from "./LassoOverlay";
import { ZoomLens } from "./ZoomLens";
import { CommandPalette } from "./CommandPalette";
import { KeyboardHints } from "./KeyboardHints";
import { ApplyThemeAttribute } from "./ThemeSwitcher";
import { FilmStripScrubber } from "./FilmStripScrubber";
import { DualCanvasContainer, DualSplitToggleButton } from "./DualCanvasContainer";
import { DebugHud } from "./DebugHud";
import { EvidencePanel } from "./EvidencePanel";
import { DevModeLayer, type DevModeLayerApi } from "./DevModeLayer";
import { RegressionHuntPanel } from "./RegressionHuntPanel";
import { RefactorPreviewOverlay } from "./RefactorPreviewOverlay";
import { PrReplayLauncher } from "./PrReplayLauncher";
import { BisectGame } from "./BisectGame";
import { AuthorFootprintLegend } from "./AuthorFootprintOverlay";
import { EditModeHint } from "./inline-editor/EditModeHint";
import { CommitFlash } from "./inline-editor/CommitFlash";
import { useFeature } from "../store/feature-flags-store";
import { figmaModeStore, useFigmaMode } from "../store/figma-mode-store";

// ------------------------------------------------------------------
// CanvasLayers — pure compositor for MultiFileCanvas overlay layers.
// ------------------------------------------------------------------
// Single responsibility: mount every child layer/toolbar/panel that
// sits ON TOP OF the core world (grid + PixiStage + DOM card layer).
// This component is a dumb JSX tree — it does NOT subscribe to any
// store. Every bit of state flows in via props so MultiFileCanvas
// remains the single source of truth for world/viewport state.
//
// Grouping rationale: tightly-coupled prop bundles (CanvasControls
// inputs, CommandPalette action callbacks, KeyboardHints overlay
// state) are exposed as nested slice objects so the top-level prop
// count stays readable.

/**
 * Inputs for the CanvasControls chrome (zoom/fit buttons, edge toggle).
 * Bundled so MultiFileCanvas can pass a single memoized object rather
 * than drilling six separate props through CanvasLayers.
 */
export interface CanvasControlsSlice {
  /** Master edges toggle — reflects renderSettingsStore.showEdges. */
  showEdges: boolean;
  /** Current edge count for the HUD readout. */
  edgeCount: number;
  onZoomIn: () => void;
  onZoomOut: () => void;
  onFit: () => void;
  onToggleEdges: () => void;
}

/**
 * Inputs for the CommandPalette overlay. `fitToGraph` intentionally
 * reuses {@link CanvasControlsSlice.onFit} — the palette's "fit" entry
 * and the zoom HUD's fit button always behave identically.
 */
export interface CommandPaletteSlice {
  open: boolean;
  onClose: () => void;
  zoomToFile: (fileId: string) => void;
  resetViewport: () => void;
  exportPng: () => void;
}

/** KeyboardHints "?" overlay state. */
export interface KeyboardHintsSlice {
  open: boolean;
  onClose: () => void;
}

export interface CanvasLayersProps {
  /** Active CSS transform string for world-space layers. */
  transform: string;
  /** Current viewport scale — forwarded to layers that scale glyphs. */
  scale: number;
  /** Full viewport state — Minimap / MiniViewport readouts. */
  viewport: Viewport;
  /** Active LOD tier — gates layers that only make sense at specific zooms (e.g. EdgeHighlightLayer is street/ground-only). */
  lod: LodLevel;
  /** Current layout or null during (re)compute — consumed by badge / minimap / lasso layers. */
  layout: WorkspaceLayout | null;
  /** Full graph — ReviewLayer, CollabLayer, FilmStrip, legend etc. */
  graph: WorkspaceGraph;
  /** Canvas container element — needed by layers that translate client coords to world. */
  containerRef: RefObject<HTMLDivElement | null>;
  /** `Z` modifier ref from useModifierKeyTracking — drives the ZoomLens gate. */
  zoomLensHeldRef: MutableRefObject<boolean>;
  /** CanvasControls chrome slice. */
  controls: CanvasControlsSlice;
  /** CommandPalette overlay slice. */
  palette: CommandPaletteSlice;
  /** KeyboardHints overlay slice. */
  keyboardHints: KeyboardHintsSlice;
  /** Dev Mode state-machine hand-off (measure mode). */
  onDevModeReady: (api: DevModeLayerApi) => void;
}

export function CanvasLayers(props: CanvasLayersProps) {
  const {
    transform,
    scale,
    viewport,
    lod,
    layout,
    graph,
    containerRef,
    zoomLensHeldRef,
    controls,
    palette,
    keyboardHints,
    onDevModeReady,
  } = props;

  return (
    <>
      <EdgeHighlightLayer transform={transform} layout={layout} lod={lod} />
      <StickiesLayer transform={transform} scale={scale} />
      <ImagesLayer transform={transform} scale={scale} containerRef={containerRef} />
      <CollabLayer
        transform={transform}
        scale={scale}
        layout={layout}
        graph={graph}
      />
      <AnnotationsLayer transform={transform} scale={scale} containerRef={containerRef} />
      <ReviewLayer graph={graph} transform={transform} scale={scale} />
      <TicketsLayer transform={transform} />
      <SlackThreadsLayer transform={transform} />
      <PrBadgesLayer transform={transform} />
      <AnomalyBadgesLayer layout={layout} transform={transform} />
      <Minimap layout={layout} viewport={viewport} />
      <CanvasControls
        scale={viewport.scale}
        onZoomIn={controls.onZoomIn}
        onZoomOut={controls.onZoomOut}
        onFit={controls.onFit}
        showEdges={controls.showEdges}
        edgeCount={controls.edgeCount}
        onToggleEdges={controls.onToggleEdges}
      />
      <AnnotationToolbar />
      <div className="ws-nav-stack">
        <BookmarksDrawer />
        <PagesTabBar />
      </div>
      <StoryboardPlayer />
      <LassoOverlay containerRef={containerRef} layout={layout} />
      <BulkActionsToolbar layout={layout} />
      <ZoomLens containerRef={containerRef} layout={layout} zoomLensHeldRef={zoomLensHeldRef} />
      <CommandPalette
        open={palette.open}
        onClose={palette.onClose}
        zoomToFile={palette.zoomToFile}
        fitToGraph={controls.onFit}
        resetViewport={palette.resetViewport}
        exportPng={palette.exportPng}
      />
      <KeyboardHints
        open={keyboardHints.open}
        onClose={keyboardHints.onClose}
      />
      <ApplyThemeAttribute containerRef={containerRef} />
      <FilmStripScrubber graph={graph} />
      <DualSplitMount graph={graph} />
      <DebugHud />
      <EvidencePanel />
      <DevModeLayer onReady={onDevModeReady} />
      <RegressionHuntPanel />
      <RefactorPreviewOverlay />
      <PrReplayLauncher />
      <BisectGame />
      <AuthorFootprintLegend history={graph.history} />
      <EditModeHint />
      <CommitFlash />
      {/* Figma-style shell (P0). Gated by power.figmaShell so the chrome
          can be disabled without losing any functionality — every action
          it exposes is also available in the existing HUD / overlays.
          `\` toggles the whole shell (escape-hatch for "my edges went
          behind a panel, just give me the canvas"). */}
      <FigmaShellBundle />
    </>
  );
}

function FigmaShellBundle() {
  const enabled = useFeature("power.figmaShell");
  const shellVisible = useFigmaMode(s => s.shellVisible);

  useEffect(() => {
    if (!enabled) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "\\") return;
      // Don't hijack the key while the user is typing in an input —
      // DSL textarea + pin note field both accept backslash.
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === "INPUT" || t.tagName === "TEXTAREA" || t.isContentEditable)) return;
      e.preventDefault();
      figmaModeStore.toggleShell();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [enabled]);

  if (!enabled || !shellVisible) return null;
  return (
    <>
      <FigmaTopBar />
      <FigmaLeftRail />
      <FigmaRightInspector />
      <ConstellationView />
      <UniverseDomainPane />
      <RoomFlowPanel />
      <InvestigationBoard />
      <PathPlaybackBar />
    </>
  );
}

// Feature-gated mount for the dual-split toggle + container. The split
// UI is rendered as an overlay on top of the shared canvas; the toggle
// is a small button affordance placed near the minimap.
function DualSplitMount({ graph }: { graph: WorkspaceGraph }) {
  const on = useFeature("temporal.dualSplit");
  if (!on) return null;
  return (
    <div style={{ position: "absolute", bottom: 12, left: 200, zIndex: 3 }}>
      <DualSplitToggleButton graph={graph} />
      <DualCanvasContainer graph={graph}>
        {/* The split renders its own chrome; the actual canvas content
            is the surrounding MultiFileCanvas tree, shared across panes
            in the v1 implementation. */}
        <span />
      </DualCanvasContainer>
    </div>
  );
}
