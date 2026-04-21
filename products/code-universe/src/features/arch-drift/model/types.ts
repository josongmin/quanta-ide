import type { ArchLayer, WorkspaceGraph } from "@quanta/canvas-engine";

// ── Row ──────────────────────────────────────────────────────────────

export interface ArchDriftRow {
  fileId: string;
  fileName: string;
  kind: "layer-escalation" | "fanout-explosion" | "new-cycle-member" | "ownership-shift";
  severity: "low" | "medium" | "high";
  detail: string;
  beforeLayer: ArchLayer;
  afterLayer: ArchLayer;
  beforeDegree: number;
  afterDegree: number;
  /** Hex color string for the severity badge background. */
  severityColor: string;
}

// ── Layout ───────────────────────────────────────────────────────────

export interface ArchDriftLayout {
  rows: ArchDriftRow[];
  highCount: number;
  mediumCount: number;
  lowCount: number;
  totalCount: number;
  /** False when graph.history is undefined. */
  hasHistory: boolean;
}

// ── Build options ─────────────────────────────────────────────────────

export interface BuildArchDriftLayoutOpts {
  graph: WorkspaceGraph;
}
