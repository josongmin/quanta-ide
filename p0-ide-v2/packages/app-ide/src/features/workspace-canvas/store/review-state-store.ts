import { useSyncExternalStore } from "react";

// Review state store (review.kanban)
// ------------------------------------------------------------------
// Tracks per-file PR review lane + the kanban overlay visibility.
// Files with no explicit `reviewLane` fall into "todo" by default when
// rendered in kanban mode. The store owns only the assignment map;
// actual column → file mapping is derived at render time.

export type ReviewLane = "todo" | "review" | "approved";

export const REVIEW_LANES: readonly ReviewLane[] = ["todo", "review", "approved"] as const;

export const REVIEW_LANE_LABEL: Record<ReviewLane, string> = {
  todo: "Todo",
  review: "In review",
  approved: "Approved",
};

export interface ReviewStateShape {
  /** fileId → lane. Missing = implicit "todo" for rendering. */
  lanes: Readonly<Record<string, ReviewLane>>;
  /** Whether the kanban overlay mode is currently active on canvas. */
  kanbanVisible: boolean;
}

const STORAGE_KEY = "quanta.canvas.review.kanban.v1";

function isLane(v: unknown): v is ReviewLane {
  return v === "todo" || v === "review" || v === "approved";
}

function readPersisted(): ReviewStateShape | null {
  try {
    const raw = typeof localStorage === "undefined"
      ? null
      : localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return null;
    const lanes: Record<string, ReviewLane> = {};
    if (parsed.lanes && typeof parsed.lanes === "object") {
      for (const [k, v] of Object.entries(parsed.lanes as Record<string, unknown>)) {
        if (isLane(v)) lanes[k] = v;
      }
    }
    return {
      lanes,
      kanbanVisible: typeof parsed.kanbanVisible === "boolean" ? parsed.kanbanVisible : false,
    };
  } catch {
    return null;
  }
}

function writePersisted(s: ReviewStateShape): void {
  try {
    if (typeof localStorage === "undefined") return;
    localStorage.setItem(STORAGE_KEY, JSON.stringify(s));
  } catch {
    // best-effort
  }
}

let state: ReviewStateShape = readPersisted() ?? { lanes: {}, kanbanVisible: false };
const listeners = new Set<() => void>();

function emit() {
  for (const l of [...listeners]) l();
  writePersisted(state);
}

function getState(): ReviewStateShape {
  return state;
}

function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

const actions = {
  setLane(fileId: string, lane: ReviewLane): void {
    if (state.lanes[fileId] === lane) return;
    state = { ...state, lanes: { ...state.lanes, [fileId]: lane } };
    emit();
  },

  clearLane(fileId: string): void {
    if (!(fileId in state.lanes)) return;
    const next = { ...state.lanes };
    delete next[fileId];
    state = { ...state, lanes: next };
    emit();
  },

  laneOf(fileId: string): ReviewLane {
    return state.lanes[fileId] ?? "todo";
  },

  setKanbanVisible(v: boolean): void {
    if (state.kanbanVisible === v) return;
    state = { ...state, kanbanVisible: v };
    emit();
  },

  toggleKanban(): void {
    state = { ...state, kanbanVisible: !state.kanbanVisible };
    emit();
  },

  reset(): void {
    state = { lanes: {}, kanbanVisible: false };
    emit();
  },
};

export const reviewStateStore = { getState, subscribe, ...actions };

export function useReviewStateStore<T>(selector: (s: ReviewStateShape) => T): T {
  return useSyncExternalStore(
    reviewStateStore.subscribe,
    () => selector(reviewStateStore.getState()),
    () => selector(reviewStateStore.getState()),
  );
}

export function countByLane(state: ReviewStateShape, fileIds: readonly string[]): Record<ReviewLane, number> {
  const out: Record<ReviewLane, number> = { todo: 0, review: 0, approved: 0 };
  for (const id of fileIds) {
    const l = state.lanes[id] ?? "todo";
    out[l] += 1;
  }
  return out;
}
