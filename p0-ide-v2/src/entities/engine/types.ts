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

export type GutterGlyph =
  | "taint-source"
  | "taint-sink"
  | "taint-through"
  | "taint-sanitized"
  | "arch-violation"
  | "dead"
  | "typestate"
  | "incident-match";

export interface GutterMark {
  line: number;
  glyph: GutterGlyph;
  title: string;
}

export interface RiskPoint {
  line: number;
  severity: 1 | 2 | 3 | 4;
  kind: "blast" | "taint" | "cpx" | "typestate" | "dead" | "arch";
}

export interface ImportFacts {
  line: number;
  module: string;
  archViolation?: { fromLayer: string; toLayer: string; rule: string };
  importsFromFile?: string;
  blastIn?: number;
}

export interface CallSiteFacts {
  line: number;
  callee: string;
  calleeFile: string;
  taintPath?: TaintPath;
  effects?: string[];
  async?: boolean;
}

export interface TaintPath {
  id: string;
  owasp?: string;
  severity: 1 | 2 | 3;
  steps: { line: number; symbol: string; hop: "source" | "propagate" | "branch" | "sink"; detail: string; file?: string }[];
  sanitizerHints?: string[];
}

export interface BlastTarget {
  file: string;
  riskScore: number;
  callPath: string[];
  reason: "direct-caller" | "transitive-caller" | "shared-data" | "test";
}

export interface Incident {
  id: string;
  date: string;
  title: string;
  patternKind: "taint" | "typestate" | "cpx-spike" | "arch-drift";
  confidence: number;
  matchDetail: string;
  postmortemUrl?: string;
}

export interface BehaviorDiffChunk {
  line: number;
  kind: "syntax" | "semantic" | "runtime";
  summary: string;
  before?: string;
  after?: string;
}

export interface FileFacts {
  name: string;
  loc: number;
  blast: number;
  blastCritical: number;
  taintCount: number;
  cpxMax: number;
  cpxBudgetPct: number;
  archViolations: number;
  deadCount: number;
  riskScore: number;
  lastModified: string;
  owner: string;
  symbols: SymbolFacts[];
  functionHeaders: FunctionHeader[];
  gutter: GutterMark[];
  minimap: RiskPoint[];
  imports: ImportFacts[];
  callSites: CallSiteFacts[];
  taintPaths: TaintPath[];
  blastTargets: BlastTarget[];
  incidents: Incident[];
  behaviorDiff: BehaviorDiffChunk[];
  ownership: { author: string; pct: number; role: "primary" | "contributor" | "orphan" }[];
}
