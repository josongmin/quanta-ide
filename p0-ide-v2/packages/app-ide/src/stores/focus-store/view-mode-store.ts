export type ViewMode = "code" | "canvas" | "security-rules";

export interface ViewModeState {
  viewMode: ViewMode;
}

export interface ViewModeStore {
  get(): ViewModeState;
  subscribe(l: () => void): () => void;
  setViewMode(mode: ViewMode): void;
  toggleViewMode(): void;
}

export function createViewModeStore(notify: () => void): ViewModeStore {
  let state: ViewModeState = { viewMode: "code" };
  const listeners = new Set<() => void>();
  const emit = () => {
    for (const l of listeners) l();
    notify();
  };

  return {
    get: () => state,
    subscribe(l) {
      listeners.add(l);
      return () => {
        listeners.delete(l);
      };
    },
    setViewMode(mode) {
      state = { ...state, viewMode: mode };
      emit();
    },
    toggleViewMode() {
      state = { ...state, viewMode: state.viewMode === "code" ? "canvas" : "code" };
      emit();
    },
  };
}
