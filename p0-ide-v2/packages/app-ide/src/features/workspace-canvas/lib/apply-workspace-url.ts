import { renderSettingsStore } from "../store/render-settings-store";
import { uxSettingsStore } from "../store/ux-settings-store";
import { debugSettingsStore } from "../store/debug-settings-store";
import { viewportStore } from "../store/viewport-store";
import { interactionStore } from "../store/interaction-store";
import { applyPreset, inferActivePreset } from "./feature-presets";
import type { WorkspaceUrlState } from "./workspace-url";

export function applyWorkspaceUrlState(state: WorkspaceUrlState): void {
  // Preset (if present) is applied FIRST so that any individual flag
  // fields encoded alongside it can override on top. In the common case
  // (encoder used compaction) no individual flag fields exist and the
  // preset alone restores the flag set.
  if (typeof state.preset === "string" && state.preset.length > 0) {
    applyPreset(state.preset);
  }

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

  // NOTE: `forceLod` was removed from `WorkspaceUrlState` (see the type
  // declaration). The omission is the primary firewall — there is no
  // typed field for us to read. We keep this gap in the apply sequence
  // as a deliberate defense-in-depth marker: even a legacy URL that
  // still carries the field at runtime cannot reach debugSettingsStore
  // because nothing here reads it. `captureWorkspaceUrlState` likewise
  // never emits it.

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
    interactionStore.setFocusMode(state.focusMode);
  }

  if (state.focusHops !== undefined) {
    interactionStore.setFocusHops(state.focusHops);
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
  const viewport = viewportStore.getState().viewport;
  const interaction = interactionStore.getState();

  const out: WorkspaceUrlState = {
    version: 1,
    viewport: { x: viewport.x, y: viewport.y, scale: viewport.scale },
    selectedFileId: interaction.viewState.selectedFileId,
    edgeLayers: { ...render.edgeLayers },
    edgeMinSeverity: render.edgeMinSeverity,
    focusMode: interaction.focusMode,
    focusHops: interaction.focusHops,
    edgeFilterQuery: render.edgeFilterQuery,
    highlightArchViolations: render.highlightArchViolations,
    showSccBubbles: render.showSccBubbles,
    showStartHereBadges: render.showStartHereBadges,
    showHeatmap: ux.showHeatmap,
    showClusterEdges: render.showClusterEdges,
    showBlameGutter: render.showBlameGutter,
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

  // Feature-preset compaction: if the current flag state matches a
  // registered preset exactly, stash only the preset id. Individual flag
  // fields are not stored on WorkspaceUrlState today (flags live in
  // localStorage) so compaction currently just adds the `preset` hint —
  // it remains useful for restoring share-link recipients whose local
  // flag state differs from the sender's.
  const activePreset = inferActivePreset();
  if (activePreset) out.preset = activePreset;

  return out;
}

export function resetWorkspaceUrlState(): void {
  debugSettingsStore.setForceLod("auto");
  renderSettingsStore.setEdgeLayer("structural", true);
  renderSettingsStore.setEdgeLayer("flow", true);
  renderSettingsStore.setEdgeLayer("safety", true);
  renderSettingsStore.setEdgeLayer("impact", true);
  renderSettingsStore.setEdgeMinSeverity("low");
  interactionStore.setFocusMode("on");
  interactionStore.setFocusHops(1);
  renderSettingsStore.setEdgeFilterQuery("");
  renderSettingsStore.setHighlightArchViolations(true);
  renderSettingsStore.setShowSccBubbles(true);
  renderSettingsStore.setShowStartHereBadges(true);
  uxSettingsStore.setShowHeatmap(true);
  renderSettingsStore.setShowClusterEdges(true);
  renderSettingsStore.setShowBlameGutter(true);
  interactionStore.setTemporalMode("off");
  interactionStore.clearPathQuery();
  interactionStore.setInspectedEvidence(null);
  interactionStore.selectFile(null);
}
