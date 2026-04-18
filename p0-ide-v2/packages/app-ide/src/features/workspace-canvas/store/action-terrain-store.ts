import { useSyncExternalStore } from "react";
import type {
  RefactorRoiResult,
  RefactorPlan,
  RefactorSimulationResult,
} from "@quanta/canvas-engine";
import { DEFAULT_ISO_CONFIG, type IsoConfig } from "@quanta/canvas-pixi";

export type ConeDirection = "blast" | "fix";

export interface ActionTerrainState {
  mode: boolean;
  selectedFileId: string | null;
  coneDirection: ConeDirection;
  activePlanId: string | null;
  showSimulationDelta: boolean;
  heightScale: number;
}

const STORAGE_KEY = "quanta.canvas.actionTerrain.v1";

const HEIGHT_MIN = 0.2;
const HEIGHT_MAX = 2;

const DEFAULT_STATE: ActionTerrainState = {
  mode: false,
  selectedFileId: null,
  coneDirection: "blast",
  activePlanId: null,
  showSimulationDelta: false,
  heightScale: 1,
};

function clampHeight(v: number): number {
  if (!Number.isFinite(v)) return 1;
  if (v < HEIGHT_MIN) return HEIGHT_MIN;
  if (v > HEIGHT_MAX) return HEIGHT_MAX;
  return v;
}

function readPersisted(): ActionTerrainState {
  if (typeof localStorage === "undefined") return DEFAULT_STATE;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return DEFAULT_STATE;
    const parsed = JSON.parse(raw) as Partial<ActionTerrainState> | null;
    if (!parsed || typeof parsed !== "object") return DEFAULT_STATE;
    return {
      ...DEFAULT_STATE,
      mode: typeof parsed.mode === "boolean" ? parsed.mode : DEFAULT_STATE.mode,
      heightScale:
        typeof parsed.heightScale === "number"
          ? clampHeight(parsed.heightScale)
          : DEFAULT_STATE.heightScale,
      coneDirection:
        parsed.coneDirection === "fix" || parsed.coneDirection === "blast"
          ? parsed.coneDirection
          : DEFAULT_STATE.coneDirection,
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function writePersisted(state: ActionTerrainState): void {
  if (typeof localStorage === "undefined") return;
  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        mode: state.mode,
        heightScale: state.heightScale,
        coneDirection: state.coneDirection,
      }),
    );
  } catch {
    // best-effort
  }
}

let state: ActionTerrainState = readPersisted();
const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
}

function getState(): ActionTerrainState {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

const actions = {
  toggleMode(): void {
    const next = !state.mode;
    state = next
      ? { ...state, mode: true }
      : { ...state, mode: false, selectedFileId: null, activePlanId: null, showSimulationDelta: false };
    writePersisted(state);
    emit();
  },

  setMode(v: boolean): void {
    if (state.mode === v) return;
    state = v
      ? { ...state, mode: true }
      : { ...state, mode: false, selectedFileId: null, activePlanId: null, showSimulationDelta: false };
    writePersisted(state);
    emit();
  },

  selectFile(fileId: string | null): void {
    if (state.selectedFileId === fileId) return;
    state = { ...state, selectedFileId: fileId };
    emit();
  },

  setConeDirection(d: ConeDirection): void {
    if (state.coneDirection === d) return;
    state = { ...state, coneDirection: d };
    writePersisted(state);
    emit();
  },

  selectPlan(planId: string | null): void {
    if (state.activePlanId === planId && state.showSimulationDelta === (planId !== null)) return;
    state = {
      ...state,
      activePlanId: planId,
      showSimulationDelta: planId !== null,
    };
    emit();
  },

  setHeightScale(v: number): void {
    const clamped = clampHeight(v);
    if (state.heightScale === clamped) return;
    state = { ...state, heightScale: clamped };
    writePersisted(state);
    emit();
  },

  reset(): void {
    state = { ...DEFAULT_STATE };
    writePersisted(state);
    emit();
  },
};

export const actionTerrainStore = { getState, subscribe, ...actions };

export function useActionTerrainStore<T>(selector: (s: ActionTerrainState) => T): T {
  return useSyncExternalStore(
    actionTerrainStore.subscribe,
    () => selector(actionTerrainStore.getState()),
    () => selector(actionTerrainStore.getState()),
  );
}

export const ACTION_TERRAIN_HEIGHT_RANGE = { min: HEIGHT_MIN, max: HEIGHT_MAX } as const;

// ── Render slice ────────────────────────────────────────────────────
// Populated by ActionTerrainLayer (the sole hook caller); all other
// consumers read from here via selectors.

export interface ActionTerrainBarPayload {
  fileId: string;
  rect: { x: number; y: number; w: number; h: number };
  heightNorm: number;
  colorHex: number;
  alpha?: number;
  highlighted?: boolean;
}

export interface ActionTerrainConePayload {
  root: { x: number; y: number };
  rings: readonly {
    depth: number;
    nodes: readonly { x: number; y: number; fileId: string }[];
  }[];
  direction: ConeDirection;
}

export interface ActionTerrainRenderState {
  enabled: boolean;
  roi: RefactorRoiResult | null;
  suggestions: ReadonlyMap<string, readonly RefactorPlan[]>;
  simulation: RefactorSimulationResult | null;
  bars: readonly ActionTerrainBarPayload[];
  coneForRenderer: ActionTerrainConePayload | null;
  isoConfig: IsoConfig;
}

export const EMPTY_SUGGESTIONS: ReadonlyMap<string, readonly RefactorPlan[]> = new Map();
export const EMPTY_BARS: readonly ActionTerrainBarPayload[] = [];

const DEFAULT_RENDER_STATE: ActionTerrainRenderState = {
  enabled: false,
  roi: null,
  suggestions: EMPTY_SUGGESTIONS,
  simulation: null,
  bars: EMPTY_BARS,
  coneForRenderer: null,
  isoConfig: DEFAULT_ISO_CONFIG,
};

let renderState: ActionTerrainRenderState = DEFAULT_RENDER_STATE;
const renderListeners = new Set<() => void>();

function emitRender() {
  for (const l of [...renderListeners]) l();
}

function renderStatesEqual(a: ActionTerrainRenderState, b: ActionTerrainRenderState): boolean {
  return (
    a.enabled === b.enabled &&
    a.roi === b.roi &&
    a.suggestions === b.suggestions &&
    a.simulation === b.simulation &&
    a.bars === b.bars &&
    a.coneForRenderer === b.coneForRenderer &&
    a.isoConfig === b.isoConfig
  );
}

export const actionTerrainRenderStore = {
  getState(): ActionTerrainRenderState {
    return renderState;
  },
  subscribe(listener: () => void): () => void {
    renderListeners.add(listener);
    return () => {
      renderListeners.delete(listener);
    };
  },
  set(next: ActionTerrainRenderState): void {
    if (renderStatesEqual(renderState, next)) return;
    renderState = next;
    emitRender();
  },
  reset(): void {
    if (renderState === DEFAULT_RENDER_STATE) return;
    if (!renderState.enabled && renderState.bars === EMPTY_BARS && !renderState.coneForRenderer) return;
    renderState = DEFAULT_RENDER_STATE;
    emitRender();
  },
};

export function useActionTerrainRender<T>(selector: (s: ActionTerrainRenderState) => T): T {
  return useSyncExternalStore(
    actionTerrainRenderStore.subscribe,
    () => selector(actionTerrainRenderStore.getState()),
    () => selector(actionTerrainRenderStore.getState()),
  );
}
