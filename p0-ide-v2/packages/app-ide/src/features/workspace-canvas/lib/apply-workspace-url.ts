import { renderSettingsStore } from "../store/render-settings-store";
import { uxSettingsStore } from "../store/ux-settings-store";
import { debugSettingsStore } from "../store/debug-settings-store";
import { viewportStore } from "../store/viewport-store";
import { interactionStore } from "../store/interaction-store";
import type { WorkspaceUrlState } from "./workspace-url";

export function applyWorkspaceUrlState(state: WorkspaceUrlState): void {
  if (state.viewport) {
    const vp = viewportStore.getState().viewport;
    viewportStore.setViewport({
      ...vp,
      x: state.viewport.x,
      y: state.viewport.y,
      scale: state.viewport.scale,
    });
  }

  if (state.selectedFileId !== undefined) {
    interactionStore.selectFile(state.selectedFileId);
  }

  if (state.forceLod !== undefined) {
    debugSettingsStore.setForceLod(state.forceLod);
  }

  if (state.edgeLayers) {
    for (const [layer, on] of Object.entries(state.edgeLayers)) {
      if (typeof on === "boolean") {
        renderSettingsStore.setEdgeLayer(layer as "structural" | "flow" | "safety" | "impact", on);
      }
    }
  }

  if (state.edgeMinSeverity !== undefined) {
    renderSettingsStore.setEdgeMinSeverity(state.edgeMinSeverity);
  }

  if (state.focusMode !== undefined) {
    renderSettingsStore.setFocusMode(state.focusMode);
  }

  if (state.focusHops !== undefined) {
    renderSettingsStore.setFocusHops(state.focusHops);
  }

  if (state.edgeFilterQuery !== undefined) {
    renderSettingsStore.setEdgeFilterQuery(state.edgeFilterQuery);
  }

  if (state.highlightArchViolations !== undefined) {
    renderSettingsStore.setHighlightArchViolations(state.highlightArchViolations);
  }

  if (state.showSccBubbles !== undefined) {
    renderSettingsStore.setShowSccBubbles(state.showSccBubbles);
  }

  if (state.showStartHereBadges !== undefined) {
    renderSettingsStore.setShowStartHereBadges(state.showStartHereBadges);
  }

  if (state.showHeatmap !== undefined) {
    uxSettingsStore.setShowHeatmap(state.showHeatmap);
  }

  if (state.showClusterEdges !== undefined) {
    renderSettingsStore.setShowClusterEdges(state.showClusterEdges);
  }

  if (state.showBlameGutter !== undefined) {
    renderSettingsStore.setShowBlameGutter(state.showBlameGutter);
  }

  if (state.elevationMode !== undefined) {
    renderSettingsStore.setElevationMode(state.elevationMode);
  }

  if (state.temporal) {
    interactionStore.setTemporalMode(state.temporal.mode);
    if (typeof state.temporal.snapshotIndex === "number") {
      interactionStore.setSnapshotIndex(state.temporal.snapshotIndex);
    }
    if (
      typeof state.temporal.diffFrom === "number" &&
      typeof state.temporal.diffTo === "number"
    ) {
      interactionStore.setDiffRange(state.temporal.diffFrom, state.temporal.diffTo);
    }
  }

  if (state.pathQuery) {
    interactionStore.setPathQuery({
      sourceFileId: state.pathQuery.sourceFileId,
      targetFileId: state.pathQuery.targetFileId,
      mode: state.pathQuery.mode,
      k: state.pathQuery.k,
    });
  }

  if (state.inspectedEvidenceId !== undefined) {
    interactionStore.setInspectedEvidence(state.inspectedEvidenceId);
  }
}

export function captureWorkspaceUrlState(): WorkspaceUrlState {
  const render = renderSettingsStore.getState();
  const ux = uxSettingsStore.getState();
  const debug = debugSettingsStore.getState();
  const viewport = viewportStore.getState().viewport;
  const interaction = interactionStore.getState();

  const out: WorkspaceUrlState = {
    version: 1,
    viewport: { x: viewport.x, y: viewport.y, scale: viewport.scale },
    selectedFileId: interaction.viewState.selectedFileId,
    forceLod: debug.forceLod,
    edgeLayers: { ...render.edgeLayers },
    edgeMinSeverity: render.edgeMinSeverity,
    focusMode: render.focusMode,
    focusHops: render.focusHops,
    edgeFilterQuery: render.edgeFilterQuery,
    highlightArchViolations: render.highlightArchViolations,
    showSccBubbles: render.showSccBubbles,
    showStartHereBadges: render.showStartHereBadges,
    showHeatmap: ux.showHeatmap,
    showClusterEdges: render.showClusterEdges,
    showBlameGutter: render.showBlameGutter,
    elevationMode: render.elevationMode,
    temporal: {
      mode: interaction.temporal.mode,
      snapshotIndex: interaction.temporal.snapshotIndex,
      diffFrom: interaction.temporal.diffFrom,
      diffTo: interaction.temporal.diffTo,
    },
    inspectedEvidenceId: interaction.inspectedEvidenceId,
  };

  if (interaction.pathQuery) {
    out.pathQuery = {
      sourceFileId: interaction.pathQuery.sourceFileId,
      targetFileId: interaction.pathQuery.targetFileId,
      mode: interaction.pathQuery.mode,
      k: interaction.pathQuery.k,
    };
  }

  return out;
}

export function resetWorkspaceUrlState(): void {
  debugSettingsStore.setForceLod("auto");
  renderSettingsStore.setEdgeLayer("structural", true);
  renderSettingsStore.setEdgeLayer("flow", true);
  renderSettingsStore.setEdgeLayer("safety", true);
  renderSettingsStore.setEdgeLayer("impact", true);
  renderSettingsStore.setEdgeMinSeverity("low");
  renderSettingsStore.setFocusMode("on");
  renderSettingsStore.setFocusHops(1);
  renderSettingsStore.setEdgeFilterQuery("");
  renderSettingsStore.setHighlightArchViolations(true);
  renderSettingsStore.setShowSccBubbles(true);
  renderSettingsStore.setShowStartHereBadges(true);
  uxSettingsStore.setShowHeatmap(true);
  renderSettingsStore.setShowClusterEdges(true);
  renderSettingsStore.setShowBlameGutter(true);
  renderSettingsStore.setElevationMode(false);
  interactionStore.setTemporalMode("off");
  interactionStore.clearPathQuery();
  interactionStore.setInspectedEvidence(null);
  interactionStore.selectFile(null);
}
