export type TaintHop = "source" | "propagate" | "branch" | "sink";

export interface TaintStep {
  line: number;
  symbol: string;
  hop: TaintHop;
  detail: string;
  file?: string;
}

export interface TaintPath {
  id: string;
  owasp?: string;
  severity: 1 | 2 | 3;
  steps: TaintStep[];
  sanitizerHints?: string[];
}
