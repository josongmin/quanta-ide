import { create } from "zustand";

interface IncidentModalState {
  isOpen: boolean;
  open: () => void;
  close: () => void;
}

interface IncidentState {
  current: string; // IncidentName
  setCurrent: (name: string) => void;
}

export const useIncidentModalStore = create<IncidentModalState>((set) => ({
  isOpen: false,
  open: () => set({ isOpen: true }),
  close: () => set({ isOpen: false }),
}));

export const useIncidentRepoStore = create<IncidentState>((set) => ({
  current: "axios/axios",
  setCurrent: (name) => set({ current: name }),
}));
