import { useSyncExternalStore } from "react";

// Action Terrain store — isometric "refactor ROI = z-height" mode.
// Mirrors stickies-store/annotations-store shape (useSyncExternalStore).
// Selection + active plan are ephemeral (session-only); the master toggle,
// height scale, and cone direction persist to localStorage so a reload
// lands the user back in the same mode/height they left.

export type ConeDirection = "blast" | "fix";

export interface ActionTerrainState {
  /** Master toggle — gates hook compute and renderer ctx. */
  mode: boolean;
  /** Root of the currently-rendered blast/fix cone; null clears the cone. */
  selectedFileId: string | null;
  /** Which directed cone to render when a file is selected. */
  coneDirection: ConeDirection;
  /** Active refactor plan id; null means no simulation overlay. */
  activePlanId: string | null;
  /** When true, bars render from simulated.after; false = raw ROI. */
  showSimulationDelta: boolean;
  /** 0.2..2 multiplier against maxZ — HUD slider. */
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
    // Selection + active plan are deliberately excluded — ephemeral session state.
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
    state = { ...state, mode: !state.mode };
    writePersisted(state);
    emit();
  },

  setMode(v: boolean): void {
    if (state.mode === v) return;
    state = { ...state, mode: v };
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
    // Selecting a plan implies simulation overlay ON; clearing returns to raw ROI.
    if (state.activePlanId === planId && state.showSimulationDelta === (planId !== null)) return;
    state = {
      ...state,
      activePlanId: planId,
      showSimulationDelta: planId !== null,
    };
    emit();
  },

  toggleSimulationDelta(): void {
    state = { ...state, showSimulationDelta: !state.showSimulationDelta };
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
// Kept on its own tiny store (module-scoped, not the settings slice
// above) so scene/canvas consumers can subscribe to just the derived
// overlay payload without re-rendering when a user flips coneDirection.
// Populated by ActionTerrainLayer (which runs useActionTerrain) and
// consumed by MultiFileCanvas when it composes the Pixi overlay ctx.

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
  direction: "blast" | "fix";
}

export interface ActionTerrainIsoConfigPayload {
  xShiftPerZ: number;
  maxZ: number;
}

export interface ActionTerrainRenderState {
  enabled: boolean;
  bars: readonly ActionTerrainBarPayload[];
  cone: ActionTerrainConePayload | null;
  isoConfig: ActionTerrainIsoConfigPayload;
}

const DEFAULT_RENDER_STATE: ActionTerrainRenderState = {
  enabled: false,
  bars: [],
  cone: null,
  isoConfig: { xShiftPerZ: 0.35, maxZ: 180 },
};

let renderState: ActionTerrainRenderState = DEFAULT_RENDER_STATE;
const renderListeners = new Set<() => void>();

function emitRender() {
  for (const l of [...renderListeners]) l();
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
    // Reference-equality short-circuit — ActionTerrainLayer calls this every
    // render; skip emit when nothing changed so Pixi ctx stays stable.
    if (
      renderState.enabled === next.enabled &&
      renderState.bars === next.bars &&
      renderState.cone === next.cone &&
      renderState.isoConfig === next.isoConfig
    ) {
      return;
    }
    renderState = next;
    emitRender();
  },
  reset(): void {
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
