import { describe, it, expect } from "vitest";
import {
  encodeWorkspaceState,
  decodeWorkspaceState,
  buildShareUrl,
  type WorkspaceUrlState,
} from "./workspace-url";

describe("workspace-url", () => {
  it("round-trips a complex state", () => {
    const state: WorkspaceUrlState = {
      version: 1,
      viewport: { x: 123.4, y: -56.7, scale: 0.789 },
      selectedFileId: "src/app/main.ts",
      edgeLayers: { structural: true, flow: false, safety: true, impact: false },
      edgeMinSeverity: "high",
      focusMode: "on",
      focusHops: 2,
      edgeFilterQuery: "layer:flow kind:import",
      highlightArchViolations: true,
      showSccBubbles: false,
      showStartHereBadges: true,
      showHeatmap: false,
      showClusterEdges: true,
      showBlameGutter: false,
      temporal: { mode: "diff", snapshotIndex: 2, diffFrom: 0, diffTo: 3 },
      pathQuery: {
        sourceFileId: "src/a.ts",
        targetFileId: "src/b.ts",
        mode: "k-shortest",
        k: 5,
      },
      inspectedEvidenceId: "ev-42",
    };

    const encoded = encodeWorkspaceState(state);
    const decoded = decodeWorkspaceState(encoded);
    expect(decoded).toEqual(state);
  });

  it("produces URL-safe output (no +, /, =)", () => {
    const state: WorkspaceUrlState = {
      version: 1,
      edgeFilterQuery: "a+b/c=d??&&",
    };
    const encoded = encodeWorkspaceState(state);
    expect(encoded).not.toMatch(/[+/=]/);
  });

  it("returns null for garbage input", () => {
    expect(decodeWorkspaceState("!!!not-valid-base64!!!")).toBeNull();
    expect(decodeWorkspaceState("")).toBeNull();
    expect(decodeWorkspaceState("aGVsbG8=")).toBeNull();
  });

  it("returns null for version mismatch", () => {
    const stale = { version: 99, viewport: { x: 0, y: 0, scale: 1 } };
    const encoded = encodeWorkspaceState(stale as unknown as WorkspaceUrlState);
    expect(decodeWorkspaceState(encoded)).toBeNull();
  });

  it("buildShareUrl appends ?ws=", () => {
    const state: WorkspaceUrlState = { version: 1, selectedFileId: "foo.ts" };
    const url = buildShareUrl("https://example.com/app", state);
    expect(url.startsWith("https://example.com/app?ws=")).toBe(true);
    const encoded = url.split("?ws=")[1];
    expect(decodeWorkspaceState(encoded!)).toEqual(state);
  });

  it("survives partial snapshots", () => {
    const state: WorkspaceUrlState = {
      version: 1,
      viewport: { x: 0, y: 0, scale: 1 },
    };
    const encoded = encodeWorkspaceState(state);
    const decoded = decodeWorkspaceState(encoded);
    expect(decoded).toEqual(state);
    expect(decoded?.selectedFileId).toBeUndefined();
  });

  it("round-trips a preset id", () => {
    const state: WorkspaceUrlState = {
      version: 1,
      preset: "reviewer",
    };
    const encoded = encodeWorkspaceState(state);
    const decoded = decodeWorkspaceState(encoded);
    expect(decoded).toEqual(state);
    expect(decoded?.preset).toBe("reviewer");
  });
});
