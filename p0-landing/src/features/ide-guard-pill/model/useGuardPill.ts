import { create } from "zustand";

export type GuardState = "safe" | "warn" | "blocked";

export interface GuardEntry {
  id: string;
  state: GuardState;
  rule: string;
  detail: string;
}

interface GuardPillState {
  isVisible: boolean;
  isExpanded: boolean;
  show: () => void;
  hide: () => void;
  toggle: () => void;
  collapse: () => void;
}

export const useGuardPill = create<GuardPillState>()((set) => ({
  isVisible: false,
  isExpanded: false,
  show: () => { set({ isVisible: true }); },
  hide: () => { set({ isVisible: false, isExpanded: false }); },
  toggle: () => { set((s) => ({ isExpanded: !s.isExpanded })); },
  collapse: () => { set({ isExpanded: false }); },
}));

export const GUARD_ENTRIES: GuardEntry[] = [
  {
    id: "ci",
    state: "blocked",
    rule: "blocked by 3 dependent service tests",
    detail: "checkout-svc, ledger-svc, billing-svc · failing on staging",
  },
  {
    id: "owners",
    state: "warn",
    rule: "requires @payments-core approval",
    detail: "primary owner @bob on PTO — backup expertise 41%",
  },
  {
    id: "blast",
    state: "warn",
    rule: "blast radius +18 since yesterday",
    detail: "touches 41 files (was 23) — re-review recommended",
  },
  {
    id: "policy",
    state: "safe",
    rule: "CODEOWNERS satisfied",
    detail: "all touched paths have at least 1 owner",
  },
];

export function summarize(entries: GuardEntry[]) {
  return {
    blocked: entries.filter((e) => e.state === "blocked").length,
    warn: entries.filter((e) => e.state === "warn").length,
    safe: entries.filter((e) => e.state === "safe").length,
  };
}
