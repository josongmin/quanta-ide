export type KLayer = "code" | "service" | "people" | "data";

export type KEdgeKind = "calls" | "owns" | "reads" | "writes" | "stores" | "routes";

export type KInsightSeverity = "info" | "warn" | "danger";

export interface KNode {
  id: string;
  label: string;
  layer: KLayer;
  sublabel?: string;
  onCall?: boolean;
  region?: string;
  rowCount?: number;
  riskScore?: number;
}

export interface KEdge {
  from: string;
  to: string;
  kind: KEdgeKind;
  weight: number;
  note?: string;
}

export interface KInsight {
  title: string;
  detail: string;
  severity: KInsightSeverity;
}

export interface KGraph {
  focusId: string;
  nodes: KNode[];
  edges: KEdge[];
  insights: KInsight[];
}
