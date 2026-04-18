import { useSyncExternalStore } from "react";
import type { Anomaly, AnomalyKind } from "../lib/ai-service";

// AI-alerts store (ai.anomalyAlerts)
// -------------------------------------------------------------------
// Ephemeral cache of the most recent `detectAnomalies` result, keyed
// for fast lookup by fileId. Not persisted — a layout reload will
// re-run the detection from scratch.

export interface AiAlertsState {
  anomalies: readonly Anomaly[];
  byFileId: ReadonlyMap<string, readonly Anomaly[]>;
  countByKind: Readonly<Record<AnomalyKind, number>>;
  lastRunAt: number;
  pending: boolean;
}

const EMPTY_KIND_COUNTS: Record<AnomalyKind, number> = {
  "coupling-spike": 0,
  "cycle-gone-hot": 0,
  "unreachable": 0,
  "owner-drift": 0,
};

function emptyState(): AiAlertsState {
  return {
    anomalies: [],
    byFileId: new Map(),
    countByKind: { ...EMPTY_KIND_COUNTS },
    lastRunAt: 0,
    pending: false,
  };
}

let state: AiAlertsState = emptyState();

const listeners = new Set<() => void>();
function emit(): void { for (const l of [...listeners]) l(); }
function getState(): AiAlertsState { return state; }
function subscribe(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

function indexByFile(items: readonly Anomaly[]): ReadonlyMap<string, readonly Anomaly[]> {
  const map = new Map<string, Anomaly[]>();
  for (const a of items) {
    let list = map.get(a.fileId);
    if (!list) { list = []; map.set(a.fileId, list); }
    list.push(a);
  }
  return map;
}

function tallyByKind(items: readonly Anomaly[]): Record<AnomalyKind, number> {
  const counts: Record<AnomalyKind, number> = { ...EMPTY_KIND_COUNTS };
  for (const a of items) counts[a.kind] += 1;
  return counts;
}

const actions = {
  setPending(pending: boolean): void {
    if (state.pending === pending) return;
    state = { ...state, pending };
    emit();
  },

  setAnomalies(anomalies: readonly Anomaly[]): void {
    state = {
      anomalies,
      byFileId: indexByFile(anomalies),
      countByKind: tallyByKind(anomalies),
      lastRunAt: Date.now(),
      pending: false,
    };
    emit();
  },

  clear(): void {
    state = emptyState();
    emit();
  },
};

export const aiAlertsStore = { getState, subscribe, ...actions };

export function useAiAlerts<T>(selector: (s: AiAlertsState) => T): T {
  return useSyncExternalStore(
    aiAlertsStore.subscribe,
    () => selector(aiAlertsStore.getState()),
    () => selector(aiAlertsStore.getState()),
  );
}
