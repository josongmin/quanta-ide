import { create } from "zustand";

type RightTab = "call-graph" | "blast-radius" | "taint";

interface PanelState {
  leftOpen: boolean;
  rightOpen: boolean;
  rightTab: RightTab;
  commandPaletteOpen: boolean;
  toggleLeft: () => void;
  toggleRight: () => void;
  setRightTab: (tab: RightTab) => void;
  setCommandPalette: (open: boolean) => void;
}

export const usePanelStore = create<PanelState>((set) => ({
  leftOpen: true,
  rightOpen: true,
  rightTab: "call-graph",
  commandPaletteOpen: false,
  toggleLeft: () => set((s) => ({ leftOpen: !s.leftOpen })),
  toggleRight: () => set((s) => ({ rightOpen: !s.rightOpen })),
  setRightTab: (tab) => set({ rightTab: tab }),
  setCommandPalette: (open) => set({ commandPaletteOpen: open }),
}));
