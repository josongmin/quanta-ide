import { create } from "zustand";

export interface AnalysisItem {
  id: string;
  label: string;
  state: "done" | "loading" | "failed";
}

interface AnalysisStatusState {
  items: AnalysisItem[];
  connection: "connected" | "reconnecting" | "disconnected";
  setItems: (items: AnalysisItem[]) => void;
  setConnection: (c: AnalysisStatusState["connection"]) => void;
  retry: (id: string) => void;
}

export const useAnalysisStatus = create<AnalysisStatusState>()((set) => ({
  items: [
    { id: "callgraph", label: "Call graph", state: "done" },
    { id: "taint", label: "Taint analysis", state: "done" },
    { id: "blast", label: "Blast radius", state: "done" },
    { id: "behavior", label: "Behavior diff", state: "done" },
    { id: "dead", label: "Dead code", state: "done" },
  ],
  connection: "connected",
  setItems: (items) => { set({ items }); },
  setConnection: (connection) => { set({ connection }); },
  retry: (id) => {
    set((s) => ({
      items: s.items.map((i) =>
        i.id === id ? { ...i, state: "loading" as const } : i
      ),
    }));
    // simulate retry: resolve after 1.5s
    setTimeout(() => {
      set((s) => ({
        items: s.items.map((i) =>
          i.id === id ? { ...i, state: "done" as const } : i
        ),
      }));
    }, 1500);
  },
}));
