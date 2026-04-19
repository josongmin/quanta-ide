import { useSyncExternalStore } from "react";

export type AgentActivity = "reading" | "editing" | "analyzing" | "idle";

/**
 * Full, flattened presence shape. Historically this was the single record
 * type the whole app consumed. We still export it (and a derived
 * `state.agents` array) for backwards compatibility, but new code should
 * prefer the narrow slice hooks below — the `agents` array identity flips
 * on EVERY cursor tick, which cascades into any component that reads it.
 */
export interface AgentPresence {
  agentId: string;
  label: string;
  color: number;
  focusFileId: string | null;
  activity: AgentActivity;
  trailFileIds?: readonly string[];
  cursorWorld?: { x: number; y: number };
  updatedAt: number;
}

/**
 * Cursor slice — the high-churn half of an agent's presence record.
 *
 * Mutates on every cursor move (potentially 60+ Hz per agent). Consumers
 * that only need positional data (follow-target tracking, raw-cursor
 * overlay) subscribe here and stay quiet on activity-only churn
 * (label/color/mode changes).
 */
export interface AgentCursor {
  agentId: string;
  focusFileId: string | null;
  cursorWorld?: { x: number; y: number };
}

/**
 * Activity slice — the low-churn metadata half.
 *
 * Changes when an agent joins/leaves, switches mode (reading → editing),
 * or has its label/color reassigned. Stable across cursor tick storms,
 * so components that only render chips / labels / the debug HUD row
 * subscribe here and skip re-render on cursor-only updates.
 */
export interface AgentActivityRecord {
  agentId: string;
  label: string;
  color: number;
  activity: AgentActivity;
  trailFileIds?: readonly string[];
  updatedAt: number;
}

export interface PresenceState {
  /**
   * Flattened merged view. Kept for backwards compatibility with older
   * callers (`usePresenceStore(s => s.agents)`). Re-derived lazily when
   * either slice changes. A pure cursor-only tick flips its identity,
   * so prefer `usePresenceCursors()` / `usePresenceActivity()` when you
   * can slice narrower.
   */
  agents: readonly AgentPresence[];
}

interface InternalState {
  order: readonly string[];
  cursors: ReadonlyMap<string, AgentCursor>;
  activity: ReadonlyMap<string, AgentActivityRecord>;
  cursorVersion: number;
  activityVersion: number;
  /** Cached merged list; invalidated on any slice change. */
  mergedCache: readonly AgentPresence[] | null;
  mergedVersion: number;
}

let state: InternalState = {
  order: [],
  cursors: new Map(),
  activity: new Map(),
  cursorVersion: 0,
  activityVersion: 0,
  mergedCache: [],
  mergedVersion: 0,
};

// Two listener sets so a cursor tick does not wake subscribers that only
// care about activity metadata (and vice versa). `allListeners` is for the
// legacy `agents`-array API; we notify it on either slice change.
const cursorListeners = new Set<() => void>();
const activityListeners = new Set<() => void>();
const allListeners = new Set<() => void>();

function emitCursor() {
  for (const l of [...cursorListeners]) l();
  for (const l of [...allListeners]) l();
}

function emitActivity() {
  for (const l of [...activityListeners]) l();
  for (const l of [...allListeners]) l();
}

function buildMerged(s: InternalState): readonly AgentPresence[] {
  const out: AgentPresence[] = [];
  for (const id of s.order) {
    const c = s.cursors.get(id);
    const a = s.activity.get(id);
    if (!c || !a) continue;
    const record: AgentPresence = {
      agentId: id,
      label: a.label,
      color: a.color,
      focusFileId: c.focusFileId,
      activity: a.activity,
      updatedAt: a.updatedAt,
    };
    if (a.trailFileIds) record.trailFileIds = a.trailFileIds;
    if (c.cursorWorld) record.cursorWorld = c.cursorWorld;
    out.push(record);
  }
  return out;
}

function getMergedAgents(): readonly AgentPresence[] {
  if (state.mergedCache !== null) return state.mergedCache;
  const merged = buildMerged(state);
  state = { ...state, mergedCache: merged };
  return merged;
}

function getState(): PresenceState {
  // `agents` is a getter-style lazy property; building it here means a
  // caller that never reads `s.agents` (e.g. cursor-only consumer via
  // `subscribeCursors`) pays nothing for the merge.
  return { agents: getMergedAgents() };
}

// Legacy/full subscription — wakes on any slice change. New consumers
// should prefer `subscribeCursors` / `subscribeActivity`.
function subscribe(listener: () => void): () => void {
  allListeners.add(listener);
  return () => {
    allListeners.delete(listener);
  };
}

function subscribeCursors(listener: () => void): () => void {
  cursorListeners.add(listener);
  return () => {
    cursorListeners.delete(listener);
  };
}

function subscribeActivity(listener: () => void): () => void {
  activityListeners.add(listener);
  return () => {
    activityListeners.delete(listener);
  };
}

function getCursorVersion(): number {
  return state.cursorVersion;
}

function getActivityVersion(): number {
  return state.activityVersion;
}

function getCursors(): ReadonlyMap<string, AgentCursor> {
  return state.cursors;
}

function getActivity(): ReadonlyMap<string, AgentActivityRecord> {
  return state.activity;
}

const actions = {
  /**
   * Full-replacement API — kept for the mock-presence seed path and the
   * test harness. Splits the incoming list into both slices and bumps
   * both versions. Use the narrower `updateAgentCursor` /
   * `updateAgentActivity` from hot paths.
   */
  setAgents(list: readonly AgentPresence[]) {
    // Same-reference short-circuit preserves the old contract.
    if (state.mergedCache !== null && list === state.mergedCache) return;

    const order: string[] = [];
    const cursors = new Map<string, AgentCursor>();
    const activity = new Map<string, AgentActivityRecord>();
    for (const a of list) {
      order.push(a.agentId);
      cursors.set(a.agentId, {
        agentId: a.agentId,
        focusFileId: a.focusFileId,
        ...(a.cursorWorld ? { cursorWorld: a.cursorWorld } : {}),
      });
      activity.set(a.agentId, {
        agentId: a.agentId,
        label: a.label,
        color: a.color,
        activity: a.activity,
        updatedAt: a.updatedAt,
        ...(a.trailFileIds ? { trailFileIds: a.trailFileIds } : {}),
      });
    }
    state = {
      order,
      cursors,
      activity,
      cursorVersion: state.cursorVersion + 1,
      activityVersion: state.activityVersion + 1,
      mergedCache: list,
      mergedVersion: state.mergedVersion + 1,
    };
    emitCursor();
    emitActivity();
  },

  /**
   * Legacy combined update. Splits the patch across slices and only
   * emits on the slice(s) that actually moved — so a patch that only
   * touches `activity` will NOT wake cursor-only listeners and vice
   * versa. Prefer the dedicated hot/cold entry points below.
   */
  updateAgent(id: string, patch: Partial<Omit<AgentPresence, "agentId">>) {
    const prevCursor = state.cursors.get(id);
    const prevActivity = state.activity.get(id);
    if (!prevCursor || !prevActivity) return;

    const cursorTouched =
      "focusFileId" in patch || "cursorWorld" in patch;
    const activityTouched =
      "label" in patch
      || "color" in patch
      || "activity" in patch
      || "updatedAt" in patch
      || "trailFileIds" in patch;

    if (!cursorTouched && !activityTouched) return;

    let nextCursors = state.cursors;
    let nextActivity = state.activity;
    let cursorVersion = state.cursorVersion;
    let activityVersion = state.activityVersion;

    if (cursorTouched) {
      const nextCursor: AgentCursor = {
        agentId: id,
        focusFileId:
          "focusFileId" in patch ? (patch.focusFileId ?? null) : prevCursor.focusFileId,
      };
      const nextCw =
        "cursorWorld" in patch ? patch.cursorWorld : prevCursor.cursorWorld;
      if (nextCw) nextCursor.cursorWorld = nextCw;
      if (
        nextCursor.focusFileId !== prevCursor.focusFileId
        || nextCursor.cursorWorld !== prevCursor.cursorWorld
      ) {
        const m = new Map(state.cursors);
        m.set(id, nextCursor);
        nextCursors = m;
        cursorVersion++;
      }
    }

    if (activityTouched) {
      const nextActivityRec: AgentActivityRecord = {
        agentId: id,
        label: "label" in patch ? patch.label! : prevActivity.label,
        color: "color" in patch ? patch.color! : prevActivity.color,
        activity:
          "activity" in patch ? patch.activity! : prevActivity.activity,
        updatedAt:
          "updatedAt" in patch ? patch.updatedAt! : prevActivity.updatedAt,
      };
      const nextTrail =
        "trailFileIds" in patch ? patch.trailFileIds : prevActivity.trailFileIds;
      if (nextTrail) nextActivityRec.trailFileIds = nextTrail;

      const changed =
        nextActivityRec.label !== prevActivity.label
        || nextActivityRec.color !== prevActivity.color
        || nextActivityRec.activity !== prevActivity.activity
        || nextActivityRec.updatedAt !== prevActivity.updatedAt
        || nextActivityRec.trailFileIds !== prevActivity.trailFileIds;

      if (changed) {
        const m = new Map(state.activity);
        m.set(id, nextActivityRec);
        nextActivity = m;
        activityVersion++;
      }
    }

    const cursorChanged = cursorVersion !== state.cursorVersion;
    const activityChanged = activityVersion !== state.activityVersion;
    if (!cursorChanged && !activityChanged) return;

    state = {
      ...state,
      cursors: nextCursors,
      activity: nextActivity,
      cursorVersion,
      activityVersion,
      mergedCache: null,
      mergedVersion: state.mergedVersion + 1,
    };
    if (cursorChanged) emitCursor();
    if (activityChanged) emitActivity();
  },

  /**
   * Hot-path cursor update. Touches only the cursor slice — activity
   * subscribers (debug HUD rows, follow list, ring labels) stay asleep.
   */
  updateAgentCursor(
    id: string,
    patch: { focusFileId?: string | null; cursorWorld?: { x: number; y: number } },
  ) {
    const prev = state.cursors.get(id);
    if (!prev) return;
    const next: AgentCursor = {
      agentId: id,
      focusFileId:
        "focusFileId" in patch ? (patch.focusFileId ?? null) : prev.focusFileId,
    };
    const nextCw =
      "cursorWorld" in patch ? patch.cursorWorld : prev.cursorWorld;
    if (nextCw) next.cursorWorld = nextCw;
    if (
      next.focusFileId === prev.focusFileId
      && next.cursorWorld === prev.cursorWorld
    ) {
      return;
    }
    const m = new Map(state.cursors);
    m.set(id, next);
    state = {
      ...state,
      cursors: m,
      cursorVersion: state.cursorVersion + 1,
      mergedCache: null,
      mergedVersion: state.mergedVersion + 1,
    };
    emitCursor();
  },

  /**
   * Cold-path activity update. Skipped by cursor-only subscribers.
   */
  updateAgentActivity(
    id: string,
    patch: Partial<Omit<AgentActivityRecord, "agentId">>,
  ) {
    const prev = state.activity.get(id);
    if (!prev) return;
    const next: AgentActivityRecord = {
      agentId: id,
      label: "label" in patch ? patch.label! : prev.label,
      color: "color" in patch ? patch.color! : prev.color,
      activity: "activity" in patch ? patch.activity! : prev.activity,
      updatedAt: "updatedAt" in patch ? patch.updatedAt! : prev.updatedAt,
    };
    const nextTrail =
      "trailFileIds" in patch ? patch.trailFileIds : prev.trailFileIds;
    if (nextTrail) next.trailFileIds = nextTrail;
    const changed =
      next.label !== prev.label
      || next.color !== prev.color
      || next.activity !== prev.activity
      || next.updatedAt !== prev.updatedAt
      || next.trailFileIds !== prev.trailFileIds;
    if (!changed) return;
    const m = new Map(state.activity);
    m.set(id, next);
    state = {
      ...state,
      activity: m,
      activityVersion: state.activityVersion + 1,
      mergedCache: null,
      mergedVersion: state.mergedVersion + 1,
    };
    emitActivity();
  },

  removeAgent(id: string) {
    if (!state.cursors.has(id) && !state.activity.has(id)) return;
    const order = state.order.filter(o => o !== id);
    const cursors = new Map(state.cursors);
    const activity = new Map(state.activity);
    cursors.delete(id);
    activity.delete(id);
    state = {
      order,
      cursors,
      activity,
      cursorVersion: state.cursorVersion + 1,
      activityVersion: state.activityVersion + 1,
      mergedCache: null,
      mergedVersion: state.mergedVersion + 1,
    };
    emitCursor();
    emitActivity();
  },
};

export const presenceStore = {
  getState,
  subscribe,
  subscribeCursors,
  subscribeActivity,
  getCursorVersion,
  getActivityVersion,
  getCursors,
  getActivity,
  ...actions,
};

/**
 * Legacy hook — subscribes to ANY slice change. Wakes on every cursor
 * tick even if the selector only reads activity metadata. Kept for
 * backwards compatibility; prefer `usePresenceCursors` /
 * `usePresenceActivity` so cursor-only churn doesn't cascade through
 * unrelated selectors in the same component.
 */
export function usePresenceStore<T>(selector: (s: PresenceState) => T): T {
  return useSyncExternalStore(
    presenceStore.subscribe,
    () => selector(presenceStore.getState()),
    () => selector(presenceStore.getState()),
  );
}

/**
 * Subscribe ONLY to cursor-slice changes. The selector receives the
 * cursors map; identity is stable across activity-only mutations.
 */
export function usePresenceCursors<T>(
  selector: (cursors: ReadonlyMap<string, AgentCursor>) => T,
): T {
  return useSyncExternalStore(
    presenceStore.subscribeCursors,
    () => selector(presenceStore.getCursors()),
    () => selector(presenceStore.getCursors()),
  );
}

/**
 * Subscribe ONLY to activity-slice changes. The selector receives the
 * activity map; identity is stable across cursor-only mutations.
 */
export function usePresenceActivity<T>(
  selector: (activity: ReadonlyMap<string, AgentActivityRecord>) => T,
): T {
  return useSyncExternalStore(
    presenceStore.subscribeActivity,
    () => selector(presenceStore.getActivity()),
    () => selector(presenceStore.getActivity()),
  );
}
