export type Protocol = "http" | "grpc" | "event" | "db";

export type ServiceKind = "service" | "external" | "datastore" | "queue";

export type FailureDomainSeverity = "info" | "warn" | "danger";

export interface ServiceNode {
  id: string;
  /** Display label, e.g. "reasoning-api". */
  label: string;
  kind: ServiceKind;
  /** Failure-domain locator, e.g. "us-east-1a". */
  region: string;
  ownerTeam: string;
  /** Current inbound RPS rolled up over a sliding window. */
  rpsIn: number;
  /** 0-1 fraction of inbound requests returning 5xx / failed gRPC status. */
  errorRate: number;
  /** True when this node represents the file-under-inspection's owning service. */
  isFocus?: boolean;
}

export interface ServiceEdge {
  from: string;
  to: string;
  protocol: Protocol;
  rps: number;
  p50Ms: number;
  p95Ms: number;
  p99Ms: number;
  /** 0-1 fraction of failed calls along this edge. */
  errorRate: number;
}

export interface FailureDomain {
  id: string;
  label: string;
  nodeIds: string[];
  severity: FailureDomainSeverity;
}

export interface ServiceMesh {
  /** Node id of the service that owns the focused file. */
  focusId: string;
  nodes: ServiceNode[];
  edges: ServiceEdge[];
  /** Ordered node ids forming the worst-cumulative-p95 chain reachable from focus. */
  criticalPath: string[];
  failureDomains: FailureDomain[];
}
