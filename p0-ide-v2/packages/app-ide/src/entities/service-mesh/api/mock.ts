import type { ServiceMesh } from "../model/types";

const orchestratorMesh: ServiceMesh = {
  focusId: "reasoning-api",
  nodes: [
    { id: "edge-gateway", label: "edge-gateway", kind: "external", region: "us-east-1a", ownerTeam: "platform", rpsIn: 1820, errorRate: 0.002 },
    { id: "reasoning-api", label: "reasoning-api", kind: "service", region: "us-east-1a", ownerTeam: "core", rpsIn: 1740, errorRate: 0.004, isFocus: true },
    { id: "policy-router", label: "policy-router", kind: "service", region: "us-east-1a", ownerTeam: "core", rpsIn: 1690, errorRate: 0.003 },
    { id: "context-store", label: "context-store", kind: "service", region: "us-west-2b", ownerTeam: "data", rpsIn: 980, errorRate: 0.001 },
    { id: "telemetry-hub", label: "telemetry-hub", kind: "service", region: "us-west-2b", ownerTeam: "obs", rpsIn: 540, errorRate: 0.031 },
    { id: "billing-api", label: "billing-api", kind: "service", region: "us-east-1a", ownerTeam: "fin", rpsIn: 220, errorRate: 0.006 },
    { id: "audit-bus", label: "audit-bus", kind: "queue", region: "us-east-1a", ownerTeam: "sec", rpsIn: 1620, errorRate: 0.0008 },
    { id: "session-cache", label: "session-cache", kind: "datastore", region: "us-east-1a", ownerTeam: "platform", rpsIn: 1480, errorRate: 0.0005 },
    { id: "context-pg", label: "context-pg", kind: "datastore", region: "us-west-2b", ownerTeam: "data", rpsIn: 980, errorRate: 0.0009 },
  ],
  edges: [
    { from: "edge-gateway", to: "reasoning-api", protocol: "http", rps: 1740, p50Ms: 14, p95Ms: 62, p99Ms: 140, errorRate: 0.004 },
    { from: "reasoning-api", to: "session-cache", protocol: "db", rps: 1480, p50Ms: 1.2, p95Ms: 6, p99Ms: 18, errorRate: 0.0005 },
    { from: "reasoning-api", to: "policy-router", protocol: "grpc", rps: 1690, p50Ms: 6, p95Ms: 28, p99Ms: 70, errorRate: 0.003 },
    { from: "reasoning-api", to: "audit-bus", protocol: "event", rps: 1620, p50Ms: 2, p95Ms: 9, p99Ms: 22, errorRate: 0.0008 },
    { from: "policy-router", to: "context-store", protocol: "grpc", rps: 980, p50Ms: 12, p95Ms: 88, p99Ms: 220, errorRate: 0.002 },
    { from: "policy-router", to: "billing-api", protocol: "http", rps: 220, p50Ms: 22, p95Ms: 140, p99Ms: 320, errorRate: 0.006 },
    { from: "context-store", to: "context-pg", protocol: "db", rps: 980, p50Ms: 8, p95Ms: 40, p99Ms: 120, errorRate: 0.0009 },
    { from: "context-store", to: "telemetry-hub", protocol: "http", rps: 540, p50Ms: 15, p95Ms: 200, p99Ms: 400, errorRate: 0.031 },
    { from: "reasoning-api", to: "telemetry-hub", protocol: "http", rps: 320, p50Ms: 18, p95Ms: 240, p99Ms: 460, errorRate: 0.034 },
    { from: "billing-api", to: "audit-bus", protocol: "event", rps: 220, p50Ms: 2, p95Ms: 8, p99Ms: 19, errorRate: 0.0006 },
    { from: "policy-router", to: "session-cache", protocol: "db", rps: 1480, p50Ms: 1.4, p95Ms: 7, p99Ms: 21, errorRate: 0.0005 },
    { from: "edge-gateway", to: "billing-api", protocol: "http", rps: 80, p50Ms: 18, p95Ms: 120, p99Ms: 280, errorRate: 0.005 },
    { from: "telemetry-hub", to: "context-pg", protocol: "db", rps: 80, p50Ms: 10, p95Ms: 70, p99Ms: 200, errorRate: 0.0012 },
  ],
  // cumulative p95: 62 + 28 + 88 + 200 = 378 + telemetry-hub branch = 62+28+200+? we list the hottest chain
  criticalPath: ["reasoning-api", "policy-router", "context-store", "telemetry-hub"],
  failureDomains: [
    { id: "fd-east", label: "us-east-1a", nodeIds: ["edge-gateway", "reasoning-api", "policy-router", "billing-api", "audit-bus", "session-cache"], severity: "info" },
    { id: "fd-west", label: "us-west-2b", nodeIds: ["context-store", "context-pg", "telemetry-hub"], severity: "warn" },
  ],
};

const routingPolicyMesh: ServiceMesh = {
  focusId: "policy-router",
  nodes: [
    { id: "policy-router", label: "policy-router", kind: "service", region: "us-east-1a", ownerTeam: "core", rpsIn: 1690, errorRate: 0.003, isFocus: true },
    { id: "reasoning-api", label: "reasoning-api", kind: "service", region: "us-east-1a", ownerTeam: "core", rpsIn: 1740, errorRate: 0.004 },
    { id: "policy-store", label: "policy-store", kind: "datastore", region: "us-east-1a", ownerTeam: "core", rpsIn: 540, errorRate: 0.0007 },
    { id: "experiment-svc", label: "experiment-svc", kind: "service", region: "us-east-1a", ownerTeam: "growth", rpsIn: 320, errorRate: 0.012 },
    { id: "audit-bus", label: "audit-bus", kind: "queue", region: "us-east-1a", ownerTeam: "sec", rpsIn: 1620, errorRate: 0.0008 },
  ],
  edges: [
    { from: "reasoning-api", to: "policy-router", protocol: "grpc", rps: 1690, p50Ms: 6, p95Ms: 28, p99Ms: 70, errorRate: 0.003 },
    { from: "policy-router", to: "policy-store", protocol: "db", rps: 540, p50Ms: 4, p95Ms: 22, p99Ms: 60, errorRate: 0.0007 },
    { from: "policy-router", to: "experiment-svc", protocol: "http", rps: 320, p50Ms: 12, p95Ms: 90, p99Ms: 240, errorRate: 0.012 },
    { from: "policy-router", to: "audit-bus", protocol: "event", rps: 1620, p50Ms: 2, p95Ms: 9, p99Ms: 22, errorRate: 0.0008 },
    { from: "experiment-svc", to: "policy-store", protocol: "db", rps: 80, p50Ms: 6, p95Ms: 36, p99Ms: 100, errorRate: 0.001 },
    { from: "policy-router", to: "reasoning-api", protocol: "grpc", rps: 60, p50Ms: 8, p95Ms: 44, p99Ms: 130, errorRate: 0.004 },
  ],
  criticalPath: ["policy-router", "experiment-svc", "policy-store"],
  failureDomains: [
    { id: "fd-east", label: "us-east-1a", nodeIds: ["policy-router", "reasoning-api", "policy-store", "experiment-svc", "audit-bus"], severity: "info" },
  ],
};

const securityMesh: ServiceMesh = {
  focusId: "auth-svc",
  nodes: [
    { id: "edge-gateway", label: "edge-gateway", kind: "external", region: "us-east-1a", ownerTeam: "platform", rpsIn: 2100, errorRate: 0.003 },
    { id: "auth-svc", label: "auth-svc", kind: "service", region: "us-east-1a", ownerTeam: "sec", rpsIn: 1980, errorRate: 0.005, isFocus: true },
    { id: "session-cache", label: "session-cache", kind: "datastore", region: "us-east-1a", ownerTeam: "platform", rpsIn: 1880, errorRate: 0.0005 },
    { id: "user-pg", label: "user-pg", kind: "datastore", region: "us-east-1a", ownerTeam: "sec", rpsIn: 420, errorRate: 0.041 },
    { id: "audit-bus", label: "audit-bus", kind: "queue", region: "us-east-1a", ownerTeam: "sec", rpsIn: 1980, errorRate: 0.0008 },
    { id: "mfa-provider", label: "mfa-provider", kind: "external", region: "ext", ownerTeam: "vendor", rpsIn: 180, errorRate: 0.018 },
  ],
  edges: [
    { from: "edge-gateway", to: "auth-svc", protocol: "http", rps: 1980, p50Ms: 12, p95Ms: 70, p99Ms: 160, errorRate: 0.005 },
    { from: "auth-svc", to: "session-cache", protocol: "db", rps: 1880, p50Ms: 1, p95Ms: 5, p99Ms: 14, errorRate: 0.0005 },
    { from: "auth-svc", to: "user-pg", protocol: "db", rps: 420, p50Ms: 9, p95Ms: 180, p99Ms: 540, errorRate: 0.041 },
    { from: "auth-svc", to: "audit-bus", protocol: "event", rps: 1980, p50Ms: 2, p95Ms: 9, p99Ms: 22, errorRate: 0.0008 },
    { from: "auth-svc", to: "mfa-provider", protocol: "http", rps: 180, p50Ms: 28, p95Ms: 220, p99Ms: 560, errorRate: 0.018 },
    { from: "mfa-provider", to: "audit-bus", protocol: "event", rps: 180, p50Ms: 3, p95Ms: 11, p99Ms: 26, errorRate: 0.001 },
  ],
  criticalPath: ["auth-svc", "user-pg"],
  failureDomains: [
    { id: "fd-east", label: "us-east-1a", nodeIds: ["edge-gateway", "auth-svc", "session-cache", "user-pg", "audit-bus"], severity: "warn" },
    { id: "fd-ext", label: "external (vendor)", nodeIds: ["mfa-provider"], severity: "danger" },
  ],
};

export const SERVICE_MESHES: Record<string, ServiceMesh> = {
  "orchestrator.py": orchestratorMesh,
  "routing_policy.py": routingPolicyMesh,
  "security.py": securityMesh,
};

export function getServiceMesh(fileName: string): ServiceMesh | null {
  return SERVICE_MESHES[fileName] ?? null;
}
