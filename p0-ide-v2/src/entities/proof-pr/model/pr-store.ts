import { useSyncExternalStore } from "react";
import { SEED_PRS } from "./sample";
import type { PRStatus, ProofCarryingPR } from "./types";

export type PRFilter = "all" | PRStatus;

interface PRState {
  prs: ProofCarryingPR[];
  selectedId: string;
  filter: PRFilter;
}

const initialSelected = SEED_PRS[0]?.id ?? "";

let state: PRState = {
  prs: SEED_PRS,
  selectedId: initialSelected,
  filter: "all",
};

const listeners = new Set<() => void>();
const emit = () => {
  for (const l of listeners) l();
};

export const prStore = {
  get: (): PRState => state,
  subscribe: (l: () => void) => {
    listeners.add(l);
    return () => {
      listeners.delete(l);
    };
  },
  select(id: string) {
    if (state.selectedId === id) return;
    state = { ...state, selectedId: id };
    emit();
  },
  setFilter(filter: PRFilter) {
    state = { ...state, filter };
    emit();
  },
  approveVerified(id: string) {
    // Mark all non-risky hunks verified (mock)
    state = {
      ...state,
      prs: state.prs.map((pr) => {
        if (pr.id !== id) return pr;
        const newHunks = pr.hunks.map((h) =>
          h.tier === "risky" ? h : { ...h, verified: true },
        );
        return { ...pr, hunks: newHunks };
      }),
    };
    emit();
  },
};

export function usePrStore<T>(selector: (s: PRState) => T): T {
  return useSyncExternalStore(prStore.subscribe, () => selector(state), () => selector(state));
}
