import { create } from "zustand";

export interface RiskAnchor {
  /** left edge of the trigger button */
  left: number;
  /** right edge of the trigger button */
  right: number;
  /** bottom edge of the trigger button */
  bottom: number;
}

interface RiskDrawerState {
  isOpen: boolean;
  anchor: RiskAnchor | null;
  open: (anchor?: RiskAnchor) => void;
  close: () => void;
  toggle: (anchor?: RiskAnchor) => void;
}

export const useRiskDrawer = create<RiskDrawerState>()((set) => ({
  isOpen: false,
  anchor: null,
  open: (anchor) => { set({ isOpen: true, anchor: anchor ?? null }); },
  close: () => { set({ isOpen: false }); },
  toggle: (anchor) => {
    set((s) => ({ isOpen: !s.isOpen, anchor: !s.isOpen ? (anchor ?? null) : s.anchor }));
  },
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
