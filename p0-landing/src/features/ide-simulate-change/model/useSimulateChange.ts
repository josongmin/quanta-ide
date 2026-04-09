import { create } from "zustand";

interface SimulateChangeState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
  toggle: () => void;
}

export const useSimulateChange = create<SimulateChangeState>()((set) => ({
  isOpen: false,
  open: () => { set({ isOpen: true }); },
  close: () => { set({ isOpen: false }); },
  toggle: () => { set((s) => ({ isOpen: !s.isOpen })); },
}));
