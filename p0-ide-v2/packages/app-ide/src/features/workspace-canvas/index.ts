export { MultiFileCanvas } from "./components/MultiFileCanvas";

// Focused stores.
export { viewportStore, useViewportStore } from "./store/viewport-store";
export { sceneStore, useSceneStore } from "./store/scene-store";
export { interactionStore, useInteractionStore } from "./store/interaction-store";
export { renderSettingsStore, useRenderSettings } from "./store/render-settings-store";
export { uxSettingsStore, useUxSettings } from "./store/ux-settings-store";
export { debugSettingsStore, useDebugSettings } from "./store/debug-settings-store";
export { pagesStore, usePagesStore, getActivePage } from "./store/pages-store";
export type { CanvasPage, CanvasPageViewport, CreatePageOpts } from "./store/pages-store";
export {
  bookmarksStore,
  useBookmarksStore,
  bookmarksForPage,
} from "./store/bookmarks-store";
export type {
  Bookmark,
  BookmarkCameraState,
  BookmarkFilterState,
  CreateBookmarkInput,
} from "./store/bookmarks-store";
export { storyboardStore, useStoryboardStore } from "./store/storyboard-store";
export type { StoryboardState, StoryboardSpeed } from "./store/storyboard-store";

export { fileFactsToWorkspaceGraph } from "./data/adapters";
export { SAMPLE_GRAPH } from "./data/sample-graph";
export { loadRepoGraph, loadFileSource, loadFileSourceBatch } from "./data/repo-loader";
export type { LoadRepoOptions, LoadRepoResult, LoadFileSourceOptions } from "./data/repo-loader";
export { normalizeWorkspaceGraphForDevScan } from "./data/normalize-dev-scan-graph";

// Adapter layer — plug a real engine in here without touching the UI.
export type { GraphSource, GraphSourceDescription } from "./data/graph-source";
export { createMockGraphSource } from "./data/mock-graph-source";
export type { MockGraphSourceConfig } from "./data/mock-graph-source";
export { setActiveGraphSource, getActiveGraphSource } from "./data/loaders";

// Temporal wiring — bridge historyStore (mock↔git swap) into graph.history.
export { installTemporalHistoryBridge, projectCommitsToGraphHistory } from "./lib/temporal-history-bridge";
