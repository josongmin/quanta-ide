import { createPanelStore } from "@/shared/model/createPanelStore";

export const useCommandPalette = createPanelStore<{
  query: string;
  setQuery: (q: string) => void;
}>((set) => ({
  query: "",
  open:     () => { set({ isOpen: true,  query: "" }); },
  toggle:   () => { set((s) => ({ isOpen: !s.isOpen, query: s.isOpen ? s.query : "" })); },
  setQuery: (query) => { set({ query }); },
}));
