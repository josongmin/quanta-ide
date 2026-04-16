import { useSyncExternalStore } from "react";
import { project } from "./projector";
import type { HorizonDays, MetricId, Projection, ProjectionInput } from "./types";

const DEFAULT_INPUT: ProjectionInput = {
  changeSetId: "cs-live",
  targetSymbol: "orchestrator.py::execute",
  currentRisk: 78,
  currentBlast: 17,
  currentCpx: 9,
  currentCoverage: 40,
  horizonDays: 7,
  metric: "risk",
};

interface CounterfactualState {
  input: ProjectionInput;
  projection: Projection;
}

function compute(input: ProjectionInput): CounterfactualState {
  return { input, projection: project(input) };
}

let state: CounterfactualState = compute(DEFAULT_INPUT);
const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export const counterfactualStore = {
  get: (): CounterfactualState => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  setHorizon(horizonDays: HorizonDays) {
    state = compute({ ...state.input, horizonDays });
    emit();
  },
  setMetric(metric: MetricId) {
    state = compute({ ...state.input, metric });
    emit();
  },
  setInput(input: Partial<ProjectionInput>) {
    state = compute({ ...state.input, ...input });
    emit();
  },
};

export function useCounterfactualStore<T>(selector: (s: CounterfactualState) => T): T {
  return useSyncExternalStore(
    counterfactualStore.subscribe,
    () => selector(state),
    () => selector(state),
  );
}
