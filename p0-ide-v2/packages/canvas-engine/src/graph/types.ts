export type ArchLayer = "domain" | "adapter" | "infra" | "ui" | "util" | "unknown";

export interface Rect { x: number; y: number; w: number; h: number; }

export interface SignalSummary {
  taintCount: number;
  blastCritical: number;
  deadCount: number;
  archViolations: number;
  cpxMax: number;
}

export interface FunctionBlock {
  name: string;
  startLine: number;
  endLine: number;
  signalCount: number;
  complexity: number;
}

// No position — WorkspaceLayout owns coordinates
export interface FileNode {
  id: string;         // file path
  name: string;
  layer: ArchLayer;
  riskScore: number;
  loc: number;
  signals: SignalSummary;
  functions: FunctionBlock[];  // City LOD — populated by DataTier 1
}

export interface FileEdge {
  id: string;
  from: string;  // FileNode.id
  to: string;
  kind: "import" | "taint-propagation" | "blast";
  weight: number;
}

export interface WorkspaceComment {
  id: string;
  fileId: string;
  line: number;
  author: string;
  body: string;
  resolved: boolean;
  createdAt: number;
}

// No position here — WorkspaceLayout is separate
export interface WorkspaceGraph {
  files: FileNode[];
  fileEdges: FileEdge[];
  comments: WorkspaceComment[];
}
