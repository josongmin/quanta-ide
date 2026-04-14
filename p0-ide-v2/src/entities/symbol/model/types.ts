export type SymbolKind = "class" | "function" | "method" | "variable" | "parameter" | "module";
export type Taint = "source" | "sink" | "passthrough" | "sanitized";

export interface SymbolFacts {
  name: string;
  kind: SymbolKind;
  detail?: string;
  line: number;
  riskScore?: number;
  complexity?: number;
  bigO?: string;
  callers?: number;
  callees?: number;
  tests?: string;
  taint?: Taint;
  dead?: boolean;
  blame?: { author: string; when: string };
  tags?: string[];
  flowsTo?: { line: number; symbol: string; hop: string }[];
  flowsFrom?: { line: number; symbol: string; hop: string }[];
}
