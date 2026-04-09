import { create } from "zustand";
interface IncidentModalState { isOpen: boolean; open: () => void; close: () => void; }
export const useIncidentModalStore = create<IncidentModalState>()((set) => ({
  isOpen: false, open: () => set({ isOpen: true }), close: () => set({ isOpen: false }),
}));
