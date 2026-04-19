import { describe, it, expect, beforeEach } from "vitest";
import {
  applyWorkspaceUrlState,
  captureWorkspaceUrlState,
  resetWorkspaceUrlState,
} from "./apply-workspace-url";
import { decodeWorkspaceState, encodeWorkspaceState } from "./workspace-url";
import { viewportStore } from "../store/viewport-store";
import { interactionStore } from "../store/interaction-store";
import { renderSettingsStore } from "../store/render-settings-store";
import { uxSettingsStore } from "../store/ux-settings-store";
import { debugSettingsStore } from "../store/debug-settings-store";
import type { WorkspaceUrlState } from "./workspace-url";

// Cover the APPLY side of the URL contract. workspace-url.test.ts already
// exercises the pure encode/decode; here we make sure the decoded state
// actually lands in the right stores, round-trips through capture, and
// fails safely on partial / corrupt input.

describe("apply-workspace-url", () => {
  beforeEach(() => {
    // Normalize stores to known defaults before each test.
    resetWorkspaceUrlState();
    viewportStore.setViewport({ x: 0, y: 0, scale: 0.1, width: 0, height: 0 });
    debugSettingsStore.setForceLod("auto");
    uxSettingsStore.setShowHeatmap(true);
  });

  it("applies a fragment into viewport + interaction stores", () => {
    const state: WorkspaceUrlState = {
      version: 1,
      viewport: { x: 42, y: -7, scale: 1.5 },
      selectedFileId: "src/entry.ts",
      focusHops: 2,
    };

    applyWorkspaceUrlState(state);

    const vp = viewportStore.getState().viewport;
    expect(vp.x).toBe(42);
    expect(vp.y).toBe(-7);
    expect(vp.scale).toBe(1.5);
    expect(interactionStore.getState().viewState.selectedFileId).toBe(
      "src/entry.ts",
    );
    expect(interactionStore.getState().focusHops).toBe(2);
  });

  it("intentionally drops forceLod — share links never force a tier", () => {
    // forceLod is a debug-only knob; carrying it in share URLs stranded
    // users on a forced tier with no obvious exit. Primary firewall is
    // the type-level omission from WorkspaceUrlState. This test asserts
    // the defense-in-depth behaviour when a LEGACY URL (from before the
    // type change) still carries the field: the apply path must treat
    // it as unrecognised and leave debugSettingsStore untouched.
    debugSettingsStore.setForceLod("auto");
    const legacyPayload = {
      version: 1 as const,
      forceLod: "ground",
    } as unknown as WorkspaceUrlState;
    applyWorkspaceUrlState(legacyPayload);
    expect(debugSettingsStore.getState().forceLod).toBe("auto");
  });

  it("round-trips capture → apply into a matching state snapshot", () => {
    const before: WorkspaceUrlState = {
      version: 1,
      viewport: { x: 123, y: 456, scale: 0.77 },
      selectedFileId: "src/round-trip.ts",
      edgeMinSeverity: "high",
      focusMode: "off",
      focusHops: 2,
      edgeFilterQuery: "layer=flow",
      highlightArchViolations: false,
      showSccBubbles: false,
      showStartHereBadges: false,
      showHeatmap: false,
      showClusterEdges: false,
      showBlameGutter: false,
      inspectedEvidenceId: "ev-round",
      temporal: { mode: "live", snapshotIndex: 3 },
    };

    applyWorkspaceUrlState(before);
    const captured = captureWorkspaceUrlState();

    // Reset and re-apply the captured state — final should match captured.
    resetWorkspaceUrlState();
    viewportStore.setViewport({ x: 0, y: 0, scale: 0.1, width: 0, height: 0 });
    applyWorkspaceUrlState(captured);
    const recaptured = captureWorkspaceUrlState();

    // Core fields survive the round trip. forceLod is intentionally NOT in
    // this list — it was removed from WorkspaceUrlState entirely (see the
    // type declaration for the rationale).
    expect(recaptured.viewport).toEqual(captured.viewport);
    expect(recaptured.selectedFileId).toBe(captured.selectedFileId);
    expect(recaptured.edgeMinSeverity).toBe(captured.edgeMinSeverity);
    expect(recaptured.focusMode).toBe(captured.focusMode);
    expect(recaptured.focusHops).toBe(captured.focusHops);
    expect(recaptured.edgeFilterQuery).toBe(captured.edgeFilterQuery);
    expect(recaptured.highlightArchViolations).toBe(
      captured.highlightArchViolations,
    );
    expect(recaptured.showSccBubbles).toBe(captured.showSccBubbles);
    expect(recaptured.showStartHereBadges).toBe(captured.showStartHereBadges);
    expect(recaptured.showHeatmap).toBe(captured.showHeatmap);
    expect(recaptured.showClusterEdges).toBe(captured.showClusterEdges);
    expect(recaptured.showBlameGutter).toBe(captured.showBlameGutter);
    expect(recaptured.inspectedEvidenceId).toBe(captured.inspectedEvidenceId);
    expect(recaptured.temporal?.mode).toBe(captured.temporal?.mode);
    // Captured state never carries forceLod (removed from the type).
    expect((captured as { forceLod?: unknown }).forceLod).toBeUndefined();
    expect((recaptured as { forceLod?: unknown }).forceLod).toBeUndefined();
  });

  it("encoded → decoded → applied preserves viewport + selection", () => {
    const state: WorkspaceUrlState = {
      version: 1,
      viewport: { x: 11, y: 22, scale: 0.33 },
      selectedFileId: "src/encoded.ts",
    };
    const encoded = encodeWorkspaceState(state);
    const decoded = decodeWorkspaceState(encoded);
    expect(decoded).not.toBeNull();
    if (decoded) applyWorkspaceUrlState(decoded);

    expect(viewportStore.getState().viewport.x).toBe(11);
    expect(viewportStore.getState().viewport.y).toBe(22);
    expect(viewportStore.getState().viewport.scale).toBe(0.33);
    expect(interactionStore.getState().viewState.selectedFileId).toBe(
      "src/encoded.ts",
    );
  });

  it("does not throw on corrupt / null decoded input; stores stay at defaults", () => {
    // Snapshot defaults.
    const defaultVp = { ...viewportStore.getState().viewport };
    const defaultSel = interactionStore.getState().viewState.selectedFileId;

    // Corrupt fragment — the decoder returns null, which the caller must
    // bail on before calling applyWorkspaceUrlState. Assert that calling
    // apply with an "empty" payload (still a valid shape) is itself a
    // no-throw no-op beyond what's inside.
    expect(decodeWorkspaceState("!!!not-valid!!!")).toBeNull();
    expect(() => applyWorkspaceUrlState({ version: 1 })).not.toThrow();

    // Nothing changed — defaults intact.
    expect(viewportStore.getState().viewport).toEqual(defaultVp);
    expect(interactionStore.getState().viewState.selectedFileId).toBe(
      defaultSel,
    );
  });

  it("partial fragment (viewport only) does not clobber unrelated store fields", () => {
    // Pre-set a selection the partial apply must NOT touch.
    interactionStore.selectFile("src/keep-me.ts");
    renderSettingsStore.setEdgeFilterQuery("preset-query");

    applyWorkspaceUrlState({
      version: 1,
      viewport: { x: 99, y: 88, scale: 2 },
    });

    const vp = viewportStore.getState().viewport;
    expect(vp.x).toBe(99);
    expect(vp.y).toBe(88);
    expect(vp.scale).toBe(2);
    // Selection + unrelated settings untouched.
    expect(interactionStore.getState().viewState.selectedFileId).toBe(
      "src/keep-me.ts",
    );
    expect(renderSettingsStore.getState().edgeFilterQuery).toBe("preset-query");
  });

  it("selectedFileId=null explicitly clears selection", () => {
    interactionStore.selectFile("src/transient.ts");
    applyWorkspaceUrlState({ version: 1, selectedFileId: null });
    expect(interactionStore.getState().viewState.selectedFileId).toBeNull();
  });

  it("edgeLayers merges into render settings without touching unmentioned layers", () => {
    renderSettingsStore.setEdgeLayer("structural", true);
    renderSettingsStore.setEdgeLayer("flow", true);
    renderSettingsStore.setEdgeLayer("safety", true);
    renderSettingsStore.setEdgeLayer("impact", true);

    applyWorkspaceUrlState({
      version: 1,
      edgeLayers: { flow: false },
    });

    const layers = renderSettingsStore.getState().edgeLayers;
    expect(layers.flow).toBe(false);
    // Others untouched.
    expect(layers.structural).toBe(true);
    expect(layers.safety).toBe(true);
    expect(layers.impact).toBe(true);
  });
});
