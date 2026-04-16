export type SymbolKind = "class" | "function" | "method" | "variable" | "parameter" | "module";
export type Taint = "source" | "sink" | "passthrough" | "sanitized";
export type Layer = "domain" | "port" | "adapter" | "infra" | "app" | "ui" | "util";
export type Heat = "hot" | "warm" | "cold";

export interface SymbolFacts {
  name: string;
  kind: SymbolKind;
  detail?: string;
  line: number;
  layer?: Layer;
  role?: string;
  contract?: { verb: "implements" | "extends"; name: string };
  why?: { label: string; href?: string };
  riskScore?: number;
  complexity?: number;
  bigO?: string;
  callers?: number;
  callees?: number;
  blast?: number;
  blastCritical?: number;
  stability?: number;
  churn90d?: number;
  heat?: { level: Heat; rate?: string };
  tests?: string;
  taint?: Taint;
  dead?: boolean;
  blame?: { author: string; when: string };
  tags?: string[];
  incidentMatch?: { id: string; similarity: number; reason: string };
  flowsTo?: { line: number; symbol: string; hop: string }[];
  flowsFrom?: { line: number; symbol: string; hop: string }[];
  deps?: {
    incoming: { name: string; layer?: Layer }[];
    outgoing: { name: string; layer?: Layer }[];
    incomingTotal?: number;
    outgoingTotal?: number;
  };
  hotPath?: { label: string; rank: number; total: number };
  lastRiskyChange?: { sha: string; author: string; when: string; risk: number; summary: string };
  relatedIncidents?: { id: string; similarity: number; when: string }[];
}
