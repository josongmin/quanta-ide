import type { EdgeSeverity } from "./types";

export type WitnessRole =
  | "source"
  | "sink"
  | "propagation"
  | "sanitizer-bypass"
  | "flow";

export interface WitnessStep {
  stepId: string;
  file: string;
  line?: number;
  symbol?: string;
  role: WitnessRole;
  snippet?: string;
  description: string;
}

export type ProofKind =
  | "taint-propagation"
  | "blast"
  | "impact"
  | "finding"
  | "cycle";

export interface ProofBundle {
  id: string;
  kind: ProofKind;
  severity: EdgeSeverity;
  summary: string;
  steps: WitnessStep[];
  analyzer: string;
  rule?: string;
  confidence?: number;
  createdAt?: number;
}
