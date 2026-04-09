import { create } from "zustand";

interface RiskDrawerState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useRiskDrawer = create<RiskDrawerState>()((set) => ({
  isOpen: false,
  open: () => { set({ isOpen: true }); },
  close: () => { set({ isOpen: false }); },
  toggle: () => { set((s) => ({ isOpen: !s.isOpen })); },
}));

export interface RiskBreakdown {
  kKey: string;
  v: string;
  bar: number;
}

export const RISK_BREAKDOWN: RiskBreakdown[] = [
  { kKey: "bkTaint", v: "3", bar: 0.6 },
  { kKey: "bkUnsafe", v: "12", bar: 0.5 },
  { kKey: "bkDead", v: "847 LOC", bar: 0.35 },
  { kKey: "bkCoverage", v: "4 funcs", bar: 0.7 },
  { kKey: "bkArch", v: "2", bar: 0.25 },
  { kKey: "bkCyclic", v: "1", bar: 0.15 },
];

export const RISK_HISTORY: number[] = [62, 65, 64, 68, 71, 74, 78];

export const RISK_RECENT: { delta: string; reasonKey: string }[] = [
  { delta: "+6", reasonKey: "rr0" },
  { delta: "+2", reasonKey: "rr1" },
  { delta: "−3", reasonKey: "rr2" },
  { delta: "+5", reasonKey: "rr3" },
];
