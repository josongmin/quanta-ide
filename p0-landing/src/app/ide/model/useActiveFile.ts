import { create } from "zustand";

export type FileName = "refund.ts" | "charge.ts" | "ledger.ts";

interface ActiveFileState {
  active: FileName;
  tabs: FileName[];
  setActive: (f: FileName) => void;
  openTab: (f: FileName) => void;
  closeTab: (f: FileName) => void;
}

export const useActiveFile = create<ActiveFileState>()((set) => ({
  active: "refund.ts",
  tabs: ["refund.ts", "charge.ts", "ledger.ts"],
  setActive: (f) => { set({ active: f }); },
  openTab: (f) => {
    set((s) => ({
      active: f,
      tabs: s.tabs.includes(f) ? s.tabs : [...s.tabs, f],
    }));
  },
  closeTab: (f) => {
    set((s) => {
      const next = s.tabs.filter((t) => t !== f);
      if (next.length === 0) return s;
      return {
        tabs: next,
        active: s.active === f ? next[0] : s.active,
      };
    });
  },
}));
