export interface Hotspot {
  id: string;
  kind: string;
  path: string;
  score: number;
  drivers: string[];
}

export interface OwnershipFact {
  path: string;
  team?: string;
  contributors?: string[];
}

export interface ViolationFact {
  id: string;
  kind: string;
  path: string;
  severity: "info" | "warn" | "error";
  description: string;
}

export interface OpportunityFact {
  id: string;
  kind: string;
  path?: string;
  score: number;
  rationale: string;
}

export interface RepositorySnapshot {
  id: string;
  repoRevision: string;
  capturedAt: string;
  metrics: Record<string, number>;
  metricHistory?: Record<string, number[]>;
  hotspots: Hotspot[];
  ownership: OwnershipFact[];
  violations: ViolationFact[];
  opportunities: OpportunityFact[];
}
