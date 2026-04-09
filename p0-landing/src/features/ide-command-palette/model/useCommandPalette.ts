import { create } from "zustand";

interface CommandPaletteState {
  isOpen: boolean;
  query: string;
  open: () => void;
  close: () => void;
  toggle: () => void;
  setQuery: (q: string) => void;
}

export const useCommandPalette = create<CommandPaletteState>()((set) => ({
  isOpen: false,
  query: "",
  open: () => { set({ isOpen: true, query: "" }); },
  close: () => { set({ isOpen: false }); },
  toggle: () => { set((s) => ({ isOpen: !s.isOpen, query: s.isOpen ? s.query : "" })); },
  setQuery: (query) => { set({ query }); },
}));
