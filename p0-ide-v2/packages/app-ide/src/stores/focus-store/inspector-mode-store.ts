export type InspectorMode = "overview" | "flow" | "blast" | "incidents" | "behavior" | "ownership";

export interface InspectorModeState {
  mode: InspectorMode;
  flowPathId?: string;
  scrollToLine?: number;
}

export interface InspectorModeStore {
  get(): InspectorModeState;
  subscribe(l: () => void): () => void;
  setMode(mode: InspectorMode, extra?: Partial<InspectorModeState>): void;
  openFlow(pathId: string): void;
  jumpTo(line: number): void;
}

export function createInspectorModeStore(notify: () => void): InspectorModeStore {
  let state: InspectorModeState = { mode: "overview" };
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
    setMode(mode, extra) {
      state = { ...state, mode, ...extra };
      emit();
    },
    openFlow(pathId) {
      state = { ...state, mode: "flow", flowPathId: pathId };
      emit();
    },
    jumpTo(line) {
      state = { ...state, scrollToLine: line };
      emit();
      queueMicrotask(() => {
        state = { ...state, scrollToLine: undefined };
        emit();
      });
    },
  };
}
