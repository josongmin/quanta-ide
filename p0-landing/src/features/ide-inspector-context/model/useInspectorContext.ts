import { create } from "zustand";

export type InspectorMode = "file" | "symbol" | "line";

export interface FileContext {
  mode: "file";
  fileName: string;
}

export interface SymbolContext {
  mode: "symbol";
  name: string;
  kind: "function" | "variable" | "import";
  taint?: "source" | "sink" | "passthrough";
  callers?: number;
  complexity?: number;
  blame?: { author: string; when: string };
  origin?: string;
  flowsTo?: string;
  // linked to a file's function data
  fileName: string;
}

export interface LineContext {
  mode: "line";
  lineNo: number;
  risk?: 1 | 2 | 3 | 4;
  summary?: string;
  detail?: string;
  fileName: string;
}

export type InspectorContext = FileContext | SymbolContext | LineContext;

interface InspectorContextState {
  context: InspectorContext;
  setFileContext: (fileName: string) => void;
  setSymbolContext: (ctx: Omit<SymbolContext, "mode">) => void;
  setLineContext: (ctx: Omit<LineContext, "mode">) => void;
  resetToFile: (fileName: string) => void;
}

export const useInspectorContext = create<InspectorContextState>()((set) => ({
  context: { mode: "file", fileName: "refund.ts" },
  setFileContext: (fileName) => set({ context: { mode: "file", fileName } }),
  setSymbolContext: (ctx) => set({ context: { mode: "symbol", ...ctx } }),
  setLineContext: (ctx) => set({ context: { mode: "line", ...ctx } }),
  resetToFile: (fileName) => set({ context: { mode: "file", fileName } }),
}));
