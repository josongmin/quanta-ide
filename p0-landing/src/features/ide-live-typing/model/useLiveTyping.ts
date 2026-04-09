import { create } from "zustand";

interface LiveTypingState {
  isEditing: boolean;
  typedText: string;
  analysisState: "idle" | "debouncing" | "analyzing" | "done";
  blastDelta: number;
  taintDelta: number;
  startEditing: () => void;
  setTypedText: (text: string) => void;
  setAnalysis: (state: LiveTypingState["analysisState"]) => void;
  setDeltas: (blast: number, taint: number) => void;
  reset: () => void;
}

export const useLiveTyping = create<LiveTypingState>()((set) => ({
  isEditing: false,
  typedText: "",
  analysisState: "idle",
  blastDelta: 0,
  taintDelta: 0,
  startEditing: () => { set({ isEditing: true }); },
  setTypedText: (text) => { set({ typedText: text }); },
  setAnalysis: (analysisState) => { set({ analysisState }); },
  setDeltas: (blastDelta, taintDelta) => { set({ blastDelta, taintDelta }); },
  reset: () => { set({ isEditing: false, typedText: "", analysisState: "idle", blastDelta: 0, taintDelta: 0 }); },
}));
