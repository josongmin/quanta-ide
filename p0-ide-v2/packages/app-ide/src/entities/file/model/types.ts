import type { SymbolFacts } from "@quanta/app-ide/entities/symbol";
import type { FunctionHeader } from "@quanta/app-ide/entities/function";
import type { GutterMark } from "@quanta/app-ide/entities/gutter";
import type { RiskPoint } from "@quanta/app-ide/entities/risk";
import type { ImportFacts } from "@quanta/app-ide/entities/import";
import type { CallSiteFacts } from "@quanta/app-ide/entities/call-site";
import type { TaintPath } from "@quanta/app-ide/entities/taint";
import type { BlastTarget } from "@quanta/app-ide/entities/blast";
import type { Incident } from "@quanta/app-ide/entities/incident";
import type { BehaviorDiffChunk } from "@quanta/app-ide/entities/behavior";
import type { OwnershipEntry } from "@quanta/app-ide/entities/ownership";
import type { ApiDrift } from "@quanta/app-ide/entities/api-surface";
import type { LLMSignal } from "@quanta/app-ide/entities/llm-signal";

export interface NextHopTarget {
  name: string;
  file?: string;
  terminalKind?: "db" | "cache" | "queue" | "api" | "storage";
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
  ownership: OwnershipEntry[];
  /** Maps external node ID → reachable next-hop targets for progressive expansion. */
  nextHops?: Record<string, NextHopTarget[]>;
  /** Number of cyclic-dep groups this file participates in. */
  cycleCount?: number;
  /** # of unique authors in last 90d (1 = knowledge silo / bus factor 1). */
  busFactor?: number;
  /** 0-100 responsibility overload score (god-class signal). */
  godScore?: number;
  /** Public API surface change since baseline. */
  apiDrift?: ApiDrift;
  /** LLM-specific risk signals detected in this file. */
  llmSignals?: LLMSignal[];
}
