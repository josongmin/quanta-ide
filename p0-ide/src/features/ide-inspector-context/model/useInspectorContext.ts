import { create } from "zustand";

export type InspectorMode = "file" | "symbol" | "line" | "repo";

export interface RepoContext {
  mode: "repo";
  repoName: string;
}

export interface FileContext {
  mode: "file";
  fileName: string;
}

export interface SymbolContext {
  mode: "symbol";
  name: string;
  kind: "function" | "method" | "constructor" | "abstract-method"
      | "lambda" | "generator" | "getter" | "setter" | "overload" | "operator"
      | "class" | "struct" | "interface" | "enum" | "type-alias" | "type-parameter" | "type-guard"
      | "variable" | "const" | "parameter" | "field" | "property" | "enum-member"
      | "module" | "import"
      | "call-site" | "decorator" | "event" | "exception"
      | "type";
  taint?: "source" | "sink" | "passthrough";
  callers?: number;
  complexity?: number;
  blame?: { author: string; when: string };
  origin?: string;
  flowsTo?: string;
  // class-specific
  methodCount?: number;
  fieldCount?: number;
  // churn (function/class)
  churn?: number;
  churnRisk?: "low" | "mid" | "high";
  coupledFiles?: string[];
  // function extras
  callees?: number;
  callDepth?: number;
  tests?: string;
  branchCoverage?: string;
  // call-site
  callee?: string;
  // parameter
  validated?: boolean;
  // type/import
  usedBy?: number;
  // linked to a file's function data
  fileName: string;
  riskScore?: number;
  tags?: string[];
  detail?: string;
}

export interface LineContext {
  mode: "line";
  lineNo: number;
  risk?: 1 | 2 | 3 | 4;
  summary?: string;
  detail?: string;
  fileName: string;
}

export type InspectorContext = RepoContext | FileContext | SymbolContext | LineContext;

interface InspectorContextState {
  context: InspectorContext;
  setRepoContext: (repoName: string) => void;
  setFileContext: (fileName: string) => void;
  setSymbolContext: (ctx: Omit<SymbolContext, "mode">) => void;
  setLineContext: (ctx: Omit<LineContext, "mode">) => void;
  resetToFile: (fileName: string) => void;
}

export const useInspectorContext = create<InspectorContextState>()((set) => ({
  context: { mode: "file", fileName: "orchestrator.py" },
  setRepoContext: (repoName) => { set({ context: { mode: "repo", repoName } }); },
  setFileContext: (fileName) => { set({ context: { mode: "file", fileName } }); },
  setSymbolContext: (ctx) => { set({ context: { mode: "symbol", ...ctx } }); },
  setLineContext: (ctx) => { set({ context: { mode: "line", ...ctx } }); },
  resetToFile: (fileName) => { set({ context: { mode: "file", fileName } }); },
}));
