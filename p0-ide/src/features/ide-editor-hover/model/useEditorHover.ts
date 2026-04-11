import { create } from "zustand";
import type { SymbolInfo } from "./symbols";

export type { SymbolInfo } from "./symbols";

export interface LineContext {
  lineNo: number;
  risk?: 1 | 2 | 3 | 4;
  summary?: string;
  detail?: string;
  x?: number;
  y?: number;
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
  setSymbol: (s) => { set(s ? { hoveredSymbol: s, hoveredLine: null } : { hoveredSymbol: null }); },
}));
