import { create } from "zustand";
import { DEFAULT_FILE } from "@/entities/code/model/sampleCode";

interface EditorState {
  activeFile: string;
  selectedSymbol: string | null;
  cursorLine: number;
  openFiles: string[];
  setActiveFile: (path: string) => void;
  setSelectedSymbol: (symbol: string | null) => void;
  setCursorLine: (line: number) => void;
}

export const useEditorStore = create<EditorState>((set) => ({
  activeFile: DEFAULT_FILE,
  selectedSymbol: null,
  cursorLine: 1,
  openFiles: [DEFAULT_FILE],
  setActiveFile: (path) =>
    set((s) => ({
      activeFile: path,
      openFiles: s.openFiles.includes(path) ? s.openFiles : [...s.openFiles, path],
    })),
  setSelectedSymbol: (symbol) => set({ selectedSymbol: symbol }),
  setCursorLine: (line) => set({ cursorLine: line }),
}));
