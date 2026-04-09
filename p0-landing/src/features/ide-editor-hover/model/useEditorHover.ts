import { create } from "zustand";

export interface SymbolInfo {
  name: string;
  kind: "function" | "variable" | "import";
  taint?: "source" | "sink" | "passthrough";
  callers?: number;
  complexity?: number;
  blame?: { author: string; when: string };
  origin?: string;
  flowsTo?: string;
}

export interface LineContext {
  lineNo: number;
  risk?: 1 | 2 | 3 | 4;
  summary?: string;
  detail?: string;
}

interface EditorHoverState {
  hoveredLine: LineContext | null;
  hoveredSymbol: { info: SymbolInfo; x: number; y: number } | null;
  setLine: (line: LineContext | null) => void;
  setSymbol: (s: { info: SymbolInfo; x: number; y: number } | null) => void;
}

export const useEditorHover = create<EditorHoverState>()((set) => ({
  hoveredLine: null,
  hoveredSymbol: null,
  setLine: (line) => { set({ hoveredLine: line }); },
  setSymbol: (s) => { set({ hoveredSymbol: s }); },
}));
