import { create } from "zustand";

export interface TraceLine {
  lineNo: number;
  kind: "source" | "through" | "sink";
}

interface FlowTraceState {
  isActive: boolean;
  lines: TraceLine[];
  activate: (lines: TraceLine[]) => void;
  deactivate: () => void;
  toggle: (lines: TraceLine[]) => void;
}

export const MOCK_TRACE: TraceLine[] = [
  { lineNo: 6, kind: "source" },
  { lineNo: 7, kind: "through" },
  { lineNo: 8, kind: "through" },
  { lineNo: 9, kind: "sink" },
];

export const useFlowTrace = create<FlowTraceState>()((set) => ({
  isActive: false,
  lines: [],
  activate: (lines) => { set({ isActive: true, lines }); },
  deactivate: () => { set({ isActive: false, lines: [] }); },
  toggle: (lines) => {
    set((s) => s.isActive ? { isActive: false, lines: [] } : { isActive: true, lines });
  },
}));
