import type { WorkspaceGraph, WorkspaceLayout, WorkspaceMetrics } from "@quanta/canvas-engine";
import type { Sticky } from "../store/stickies-store";

// AiService — contract for AI-assisted helpers surfaced in the workspace
// canvas (Batch 6). Everything here is data-in / data-out; no store writes
// and no DOM side-effects. That keeps the mock and any future real LLM
// implementation drop-in compatible — swap the factory in the wiring
// layer and every call site keeps working.
//
// All methods are async so the UI can render a loading state without
// special-casing "instant" answers. The mock implementation below
// deliberately `await`s a small delay so spinners / disabled buttons
// exercise the same code path they will at production swap.

export interface NlToDslContext {
  edgeKinds: string[];
  edgeLayers: string[];
  files: string[];
}

export interface NlToDslResult {
  dsl: string;
  confidence: number;
  explanation: string;
}

export interface StickyCluster {
  label: string;
  stickyIds: string[];
  reasoning: string;
}

export interface ClusterStickiesResult {
  clusters: StickyCluster[];
}

export interface TourStep {
  fileId: string;
  narration: string;
  focusHops: number;
}

export interface GenerateTourResult {
  steps: TourStep[];
}

export type AnomalyKind =
  | "coupling-spike"
  | "cycle-gone-hot"
  | "unreachable"
  | "owner-drift";

export type AnomalySeverity = "low" | "med" | "high";

export interface Anomaly {
  kind: AnomalyKind;
  fileId: string;
  severity: AnomalySeverity;
  explanation: string;
}

export interface DetectAnomaliesResult {
  anomalies: Anomaly[];
}

export interface AiService {
  naturalLanguageToDsl(query: string, context: NlToDslContext): Promise<NlToDslResult>;
  clusterStickies(stickies: readonly Sticky[]): Promise<ClusterStickiesResult>;
  generateTour(graph: WorkspaceGraph, layout: WorkspaceLayout): Promise<GenerateTourResult>;
  detectAnomalies(graph: WorkspaceGraph, metrics: WorkspaceMetrics): Promise<DetectAnomaliesResult>;
}
