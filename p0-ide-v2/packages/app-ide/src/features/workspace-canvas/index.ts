export { MultiFileCanvas } from "./components/MultiFileCanvas";

// Deprecated monolithic facade — kept for existing callers. New code
// should import from the four focused stores below.
export { useWorkspaceCanvas } from "./store/workspace-canvas-store";
export { workspaceCanvasStore } from "./store/workspace-canvas-store";

// New focused stores.
export { viewportStore, useViewportStore } from "./store/viewport-store";
export { sceneStore, useSceneStore } from "./store/scene-store";
export { interactionStore, useInteractionStore } from "./store/interaction-store";
export { settingsStore, useSettingsStore } from "./store/settings-store";

export { fileFactsToWorkspaceGraph } from "./data/adapters";
export { SAMPLE_GRAPH } from "./data/sample-graph";
export { loadRepoGraph, loadFileSource, loadFileSourceBatch } from "./data/repo-loader";
export type { LoadRepoOptions, LoadRepoResult, LoadFileSourceOptions } from "./data/repo-loader";

// Adapter layer — plug a real engine in here without touching the UI.
export type { GraphSource, GraphSourceDescription } from "./data/graph-source";
export { createMockGraphSource } from "./data/mock-graph-source";
export type { MockGraphSourceConfig } from "./data/mock-graph-source";
export { setActiveGraphSource, getActiveGraphSource } from "./data/loaders";
