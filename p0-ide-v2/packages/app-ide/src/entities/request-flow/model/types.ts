export type RequestStage = "entry" | "controller" | "service" | "repo" | "external" | "sink";

export interface RequestNode {
  id: string;
  label: string;
  stage: RequestStage;
  file?: string;
  line?: number;
  /** p50 latency in ms at this hop (self time, not cumulative). */
  p50Ms: number;
  /** p99 latency in ms at this hop. */
  p99Ms: number;
  /** Error rate over last 24h (0..1). */
  errorRate: number;
  /** RPS over last 5m. */
  rps: number;
  /** GitHub-style handle of the team that owns this node. */
  owner: string;
  /** Annotations: cache hit?, retried?, fan-out? */
  tag?: "cache-hit" | "retried" | "fanout" | "circuit-open";
}

export interface RequestEdge {
  from: string;
  to: string;
  /** Fraction of parent traffic that takes this edge (0..1). */
  share: number;
  /** Whether this edge is a branch (conditional) vs always-taken. */
  conditional?: boolean;
  /** Predicate that gates the branch, if any. */
  predicate?: string;
}

export interface RequestFlow {
  id: string;
  /** Human label for this end-to-end path (HTTP route or feature). */
  label: string;
  /** HTTP method + path, gRPC, or queue topic. */
  entrypoint: string;
  /** Total p99 budget for this flow (ms). */
  budgetMs: number;
  /** Observed p99 across all hops (ms). */
  observedP99Ms: number;
  nodes: RequestNode[];
  edges: RequestEdge[];
}
