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
  k: string;
  v: string;
  bar: number; // 0..1
}

export const RISK_BREAKDOWN: RiskBreakdown[] = [
  { k: "Taint paths", v: "3", bar: 0.6 },
  { k: "Unsafe writes", v: "12", bar: 0.5 },
  { k: "Dead code", v: "847 LOC", bar: 0.35 },
  { k: "Coverage gap", v: "4 funcs", bar: 0.7 },
  { k: "Arch violations", v: "2", bar: 0.25 },
  { k: "Cyclic deps", v: "1", bar: 0.15 },
];

export const RISK_HISTORY: number[] = [62, 65, 64, 68, 71, 74, 78];

export const RISK_RECENT: { delta: string; reason: string }[] = [
  { delta: "+6", reason: "blast in refund.ts" },
  { delta: "+2", reason: "new taint path (parse)" },
  { delta: "−3", reason: "dead code removed (helpers.ts)" },
  { delta: "+5", reason: "complexity in webhook handler" },
];
