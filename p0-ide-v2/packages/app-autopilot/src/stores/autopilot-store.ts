import { useSyncExternalStore } from "react";
import type { EngineeringGoal, GoalStatus } from "@quanta/app-autopilot/entities/goal";
import { GOALS, GOAL_STATUS } from "@quanta/app-autopilot/entities/goal";
import type { EngineeringPolicy } from "@quanta/app-autopilot/entities/policy";
import { POLICIES } from "@quanta/app-autopilot/entities/policy";
import type { AutonomyProfile } from "@quanta/app-autopilot/entities/autonomy";
import { AUTONOMY_PROFILES } from "@quanta/app-autopilot/entities/autonomy";
import type { OperatorSummary } from "@quanta/app-autopilot/entities/operator";
import { OPERATORS } from "@quanta/app-autopilot/entities/operator";
import type { WorkItem } from "@quanta/app-autopilot/entities/work-item";
import { WORK_ITEMS } from "@quanta/app-autopilot/entities/work-item";
import type { ExecutionRun, RunStep } from "@quanta/app-autopilot/entities/run";
import { RUNS } from "@quanta/app-autopilot/entities/run";
import type { ProofArtifact } from "@quanta/app-autopilot/entities/proof";
import { PROOFS } from "@quanta/app-autopilot/entities/proof";
import type { Opportunity } from "@quanta/app-autopilot/entities/opportunity";
import { OPPORTUNITIES } from "@quanta/app-autopilot/entities/opportunity";
import type { RepositorySnapshot } from "@quanta/app-autopilot/entities/snapshot";
import { CURRENT_SNAPSHOT } from "@quanta/app-autopilot/entities/snapshot";
import type { InboxItem } from "@quanta/app-autopilot/entities/inbox";
import { INBOX_ITEMS } from "@quanta/app-autopilot/entities/inbox";

/**
 * Single subscriber store for the autopilot app.
 *
 * Zero deps. Selector-based subscriptions via `useSyncExternalStore`.
 * Individual entity slices stay in their own fixtures; this store owns
 * the mutable runtime state (triage, dismiss, tick simulation).
 */

interface AutopilotState {
  goals: readonly EngineeringGoal[];
  goalStatus: readonly GoalStatus[];
  policies: readonly EngineeringPolicy[];
  autonomyProfiles: readonly AutonomyProfile[];
  operators: readonly OperatorSummary[];
  workItems: readonly WorkItem[];
  runs: readonly ExecutionRun[];
  proofs: readonly ProofArtifact[];
  opportunities: readonly Opportunity[];
  snapshot: RepositorySnapshot;
  inbox: readonly InboxItem[];
  dismissedInboxIds: ReadonlySet<string>;
}

let state: AutopilotState = {
  goals: GOALS,
  goalStatus: GOAL_STATUS,
  policies: POLICIES,
  autonomyProfiles: AUTONOMY_PROFILES,
  operators: OPERATORS,
  workItems: WORK_ITEMS,
  runs: RUNS,
  proofs: PROOFS,
  opportunities: OPPORTUNITIES,
  snapshot: CURRENT_SNAPSHOT,
  inbox: INBOX_ITEMS,
  dismissedInboxIds: new Set<string>(),
};

const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export const autopilotStore = {
  get: () => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  dismissInboxItem(id: string) {
    const next = new Set(state.dismissedInboxIds);
    next.add(id);
    state = { ...state, dismissedInboxIds: next };
    emit();
  },
  restoreInbox() {
    state = { ...state, dismissedInboxIds: new Set() };
    emit();
  },
  /** Append a step to a running run (timeline simulation). */
  appendRunStep(runId: string, step: RunStep) {
    const runs = state.runs.map((r) =>
      r.id === runId ? { ...r, steps: [...r.steps, step] } : r,
    );
    state = { ...state, runs };
    emit();
  },
};

export function useAutopilot<T>(selector: (s: AutopilotState) => T): T {
  return useSyncExternalStore(
    autopilotStore.subscribe,
    () => selector(state),
    () => selector(state),
  );
}

// Selector helpers -----------------------------------------------------
// Array-returning selectors are memoized by their input references so
// repeated `useSyncExternalStore` getSnapshot calls return the same
// reference between store updates (otherwise React tight-loops with the
// "getSnapshot should be cached" warning).

let liveInboxCacheInbox: readonly InboxItem[] | null = null;
let liveInboxCacheDismissed: ReadonlySet<string> | null = null;
let liveInboxCacheResult: readonly InboxItem[] = [];

function liveInbox(s: AutopilotState): readonly InboxItem[] {
  if (
    liveInboxCacheInbox === s.inbox &&
    liveInboxCacheDismissed === s.dismissedInboxIds
  ) {
    return liveInboxCacheResult;
  }
  liveInboxCacheInbox = s.inbox;
  liveInboxCacheDismissed = s.dismissedInboxIds;
  liveInboxCacheResult = s.inbox.filter((i) => !s.dismissedInboxIds.has(i.id));
  return liveInboxCacheResult;
}

const runsForGoalCache = new Map<
  string,
  { runs: readonly ExecutionRun[]; result: readonly ExecutionRun[] }
>();
function runsForGoal(goalId: string, s: AutopilotState): readonly ExecutionRun[] {
  const entry = runsForGoalCache.get(goalId);
  if (entry && entry.runs === s.runs) return entry.result;
  const result = s.runs.filter((r) => r.goalId === goalId);
  runsForGoalCache.set(goalId, { runs: s.runs, result });
  return result;
}

const workItemsForGoalCache = new Map<
  string,
  { items: readonly WorkItem[]; result: readonly WorkItem[] }
>();
function workItemsForGoal(goalId: string, s: AutopilotState): readonly WorkItem[] {
  const entry = workItemsForGoalCache.get(goalId);
  if (entry && entry.items === s.workItems) return entry.result;
  const result = s.workItems.filter((w) => w.relatedGoals.includes(goalId));
  workItemsForGoalCache.set(goalId, { items: s.workItems, result });
  return result;
}

export const selectors = {
  goalById: (id: string) => (s: AutopilotState) =>
    s.goals.find((g) => g.id === id),
  statusFor: (goalId: string) => (s: AutopilotState) =>
    s.goalStatus.find((g) => g.goalId === goalId),
  runById: (id: string) => (s: AutopilotState) => s.runs.find((r) => r.id === id),
  proofById: (id: string) => (s: AutopilotState) => s.proofs.find((p) => p.id === id),
  workItemById: (id: string) => (s: AutopilotState) =>
    s.workItems.find((w) => w.id === id),
  opportunityById: (id: string) => (s: AutopilotState) =>
    s.opportunities.find((o) => o.id === id),
  operatorById: (id: string) => (s: AutopilotState) => s.operators.find((o) => o.id === id),
  autonomyById: (id: string) => (s: AutopilotState) =>
    s.autonomyProfiles.find((a) => a.id === id),
  liveInbox,
  runsForGoal: (goalId: string) => (s: AutopilotState) => runsForGoal(goalId, s),
  workItemsForGoal: (goalId: string) => (s: AutopilotState) =>
    workItemsForGoal(goalId, s),
};
