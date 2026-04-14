import type { SymbolFacts } from "@/entities/symbol";
import type { FunctionHeader } from "@/entities/function";
import type { GutterMark } from "@/entities/gutter";
import type { RiskPoint } from "@/entities/risk";
import type { ImportFacts } from "@/entities/import";
import type { CallSiteFacts } from "@/entities/call-site";
import type { TaintPath } from "@/entities/taint";
import type { BlastTarget } from "@/entities/blast";
import type { Incident } from "@/entities/incident";
import type { BehaviorDiffChunk } from "@/entities/behavior";
import type { OwnershipEntry } from "@/entities/ownership";

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
  ownership: OwnershipEntry[];
}
