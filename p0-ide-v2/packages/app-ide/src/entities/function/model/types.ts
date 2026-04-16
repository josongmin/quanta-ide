import type { SymbolKind, Taint } from "@quanta/app-ide/entities/symbol";

export interface FunctionHeader {
  line: number;
  name: string;
  kind: SymbolKind;
  blast: number;
  blastCritical?: number;
  complexity: number;
  bigO?: string;
  tests: string;
  owner: string;
  taint?: Taint;
  dead?: boolean;
  riskScore: number;
  budgetPct?: number;
}
