import type { KGraph } from "../model/types";

const ORCHESTRATOR: KGraph = {
  focusId: "code:orchestrator.py",
  nodes: [
    // Code layer
    { id: "code:orchestrator.py", label: "orchestrator.py", layer: "code", sublabel: "py module", riskScore: 78 },
    { id: "code:planner.py", label: "planner.py", layer: "code", sublabel: "py module", riskScore: 42 },
    { id: "code:executor.py", label: "executor.py", layer: "code", sublabel: "py module", riskScore: 55 },
    { id: "code:experience_store.py", label: "experience_store.py", layer: "code", sublabel: "py module", riskScore: 36 },
    { id: "code:trace_writer.py", label: "trace_writer.py", layer: "code", sublabel: "py module", riskScore: 28 },
    // Service layer
    { id: "svc:reasoning-api", label: "reasoning-api", layer: "service", sublabel: "microservice", region: "us-east-1" },
    { id: "svc:trace-collector", label: "trace-collector", layer: "service", sublabel: "microservice", region: "us-east-1" },
    { id: "svc:postgres-proxy", label: "postgres-proxy", layer: "service", sublabel: "microservice", region: "us-east-1" },
    { id: "svc:telemetry-hub", label: "telemetry-hub", layer: "service", sublabel: "microservice", region: "us-west-2" },
    // People layer
    { id: "ppl:@songmin", label: "@songmin", layer: "people", sublabel: "on-call lead", onCall: true },
    { id: "ppl:@devops-bot", label: "@devops-bot", layer: "people", sublabel: "automation" },
    { id: "ppl:@reviewer-a", label: "@reviewer-a", layer: "people", sublabel: "reviewer" },
    { id: "ppl:@qa-lead", label: "@qa-lead", layer: "people", sublabel: "qa lead" },
    // Data layer
    { id: "data:experience_store.traces", label: "experience_store.traces", layer: "data", sublabel: "postgres table", rowCount: 120_000_000 },
    { id: "data:metrics_daily", label: "metrics_daily", layer: "data", sublabel: "postgres table", rowCount: 8_400_000 },
    { id: "data:postgres.request_logs", label: "postgres.request_logs", layer: "data", sublabel: "postgres table", rowCount: 42_000_000 },
    { id: "data:s3:incident-dumps", label: "s3:incident-dumps", layer: "data", sublabel: "s3 bucket", rowCount: 21_000 },
    // Extras
    { id: "code:policy_loader.py", label: "policy_loader.py", layer: "code", sublabel: "py module", riskScore: 24 },
    { id: "svc:feature-flags", label: "feature-flags", layer: "service", sublabel: "microservice", region: "global" },
    { id: "data:redis.session", label: "redis.session", layer: "data", sublabel: "redis keyspace", rowCount: 340_000 },
  ],
  edges: [
    // code ↔ code
    { from: "code:orchestrator.py", to: "code:planner.py", kind: "calls", weight: 0.95 },
    { from: "code:orchestrator.py", to: "code:executor.py", kind: "calls", weight: 0.9 },
    { from: "code:orchestrator.py", to: "code:experience_store.py", kind: "calls", weight: 0.7 },
    { from: "code:orchestrator.py", to: "code:trace_writer.py", kind: "calls", weight: 0.4 },
    { from: "code:orchestrator.py", to: "code:policy_loader.py", kind: "calls", weight: 0.3 },
    { from: "code:executor.py", to: "code:trace_writer.py", kind: "calls", weight: 0.5 },
    // code ↔ service (protocol)
    { from: "code:orchestrator.py", to: "svc:reasoning-api", kind: "routes", weight: 1.0, note: "top caller" },
    { from: "code:orchestrator.py", to: "svc:trace-collector", kind: "routes", weight: 0.6 },
    { from: "code:orchestrator.py", to: "svc:telemetry-hub", kind: "routes", weight: 0.4 },
    { from: "code:executor.py", to: "svc:postgres-proxy", kind: "routes", weight: 0.7 },
    { from: "code:policy_loader.py", to: "svc:feature-flags", kind: "routes", weight: 0.5 },
    // code ↔ people (ownership)
    { from: "ppl:@songmin", to: "code:orchestrator.py", kind: "owns", weight: 1.0, note: "primary" },
    { from: "ppl:@reviewer-a", to: "code:orchestrator.py", kind: "owns", weight: 0.4 },
    { from: "ppl:@songmin", to: "code:planner.py", kind: "owns", weight: 0.7 },
    { from: "ppl:@qa-lead", to: "code:executor.py", kind: "owns", weight: 0.4 },
    { from: "ppl:@devops-bot", to: "code:trace_writer.py", kind: "owns", weight: 0.6 },
    // code ↔ data (access)
    { from: "code:orchestrator.py", to: "data:experience_store.traces", kind: "writes", weight: 0.9 },
    { from: "code:orchestrator.py", to: "data:postgres.request_logs", kind: "reads", weight: 0.5 },
    { from: "code:experience_store.py", to: "data:experience_store.traces", kind: "reads", weight: 0.8 },
    { from: "code:executor.py", to: "data:redis.session", kind: "reads", weight: 0.6 },
    { from: "code:trace_writer.py", to: "data:metrics_daily", kind: "writes", weight: 0.7 },
    // service ↔ data (storage)
    { from: "svc:postgres-proxy", to: "data:experience_store.traces", kind: "stores", weight: 0.95 },
    { from: "svc:postgres-proxy", to: "data:postgres.request_logs", kind: "stores", weight: 0.85 },
    { from: "svc:trace-collector", to: "data:s3:incident-dumps", kind: "stores", weight: 0.6 },
    { from: "svc:telemetry-hub", to: "data:metrics_daily", kind: "stores", weight: 0.7 },
    // service ↔ people (ops)
    { from: "ppl:@songmin", to: "svc:reasoning-api", kind: "owns", weight: 0.8 },
    { from: "ppl:@devops-bot", to: "svc:telemetry-hub", kind: "owns", weight: 0.5 },
    { from: "ppl:@qa-lead", to: "svc:trace-collector", kind: "owns", weight: 0.3 },
    // cross
    { from: "svc:reasoning-api", to: "svc:trace-collector", kind: "calls", weight: 0.5 },
    { from: "svc:reasoning-api", to: "svc:postgres-proxy", kind: "calls", weight: 0.8 },
    { from: "code:planner.py", to: "data:metrics_daily", kind: "reads", weight: 0.3 },
  ],
  insights: [
    {
      title: "@songmin is sole on-call for orchestrator — bus factor 1",
      detail: "Only one person owns the critical path. No secondary reviewer has merged here in 60 days.",
      severity: "danger",
    },
    {
      title: "reasoning-api changes weekly and is your top caller",
      detail: "Protocol edge weight 1.0. Upstream contract drift ships 3.2× per month; consider a consumer-driven contract test.",
      severity: "warn",
    },
    {
      title: "experience_store.traces is 120M rows and grows 2GB/day",
      detail: "Writes from orchestrator.py dominate ingest. Retention policy is unset; storage cost is trending up 14%/mo.",
      severity: "info",
    },
  ],
};

const ROUTING_POLICY: KGraph = {
  focusId: "code:routing_policy.py",
  nodes: [
    { id: "code:routing_policy.py", label: "routing_policy.py", layer: "code", sublabel: "py module", riskScore: 51 },
    { id: "code:planner.py", label: "planner.py", layer: "code", sublabel: "py module", riskScore: 42 },
    { id: "code:orchestrator.py", label: "orchestrator.py", layer: "code", sublabel: "py module", riskScore: 78 },
    { id: "svc:feature-flags", label: "feature-flags", layer: "service", sublabel: "microservice", region: "global" },
    { id: "svc:reasoning-api", label: "reasoning-api", layer: "service", sublabel: "microservice", region: "us-east-1" },
    { id: "ppl:@songmin", label: "@songmin", layer: "people", sublabel: "on-call lead", onCall: true },
    { id: "ppl:@reviewer-a", label: "@reviewer-a", layer: "people", sublabel: "reviewer" },
    { id: "data:policy_rules", label: "policy_rules", layer: "data", sublabel: "postgres table", rowCount: 1_200 },
    { id: "data:routing_cache", label: "routing_cache", layer: "data", sublabel: "redis keyspace", rowCount: 95_000 },
    { id: "data:audit.routes", label: "audit.routes", layer: "data", sublabel: "postgres table", rowCount: 3_400_000 },
  ],
  edges: [
    { from: "code:orchestrator.py", to: "code:routing_policy.py", kind: "calls", weight: 0.9 },
    { from: "code:routing_policy.py", to: "code:planner.py", kind: "calls", weight: 0.5 },
    { from: "code:routing_policy.py", to: "svc:feature-flags", kind: "routes", weight: 0.8 },
    { from: "code:routing_policy.py", to: "svc:reasoning-api", kind: "routes", weight: 0.6 },
    { from: "code:routing_policy.py", to: "data:policy_rules", kind: "reads", weight: 0.9 },
    { from: "code:routing_policy.py", to: "data:routing_cache", kind: "writes", weight: 0.7 },
    { from: "code:routing_policy.py", to: "data:audit.routes", kind: "writes", weight: 0.5 },
    { from: "ppl:@songmin", to: "code:routing_policy.py", kind: "owns", weight: 0.9 },
    { from: "ppl:@reviewer-a", to: "code:routing_policy.py", kind: "owns", weight: 0.4 },
    { from: "svc:feature-flags", to: "data:policy_rules", kind: "stores", weight: 0.6 },
    { from: "svc:reasoning-api", to: "data:routing_cache", kind: "stores", weight: 0.4 },
    { from: "ppl:@songmin", to: "svc:feature-flags", kind: "owns", weight: 0.5 },
  ],
  insights: [
    {
      title: "Flag rollouts touch this file without review gates",
      detail: "feature-flags service can toggle routing branches in production; no CI contract test covers the hot paths.",
      severity: "warn",
    },
    {
      title: "policy_rules is small (1.2k rows) but audit.routes grows 3M rows/quarter",
      detail: "Writes are dominated by this module — consider a TTL on audit.routes to keep restores tractable.",
      severity: "info",
    },
  ],
};

const SECURITY: KGraph = {
  focusId: "code:security.py",
  nodes: [
    { id: "code:security.py", label: "security.py", layer: "code", sublabel: "py module", riskScore: 88 },
    { id: "code:auth_guard.py", label: "auth_guard.py", layer: "code", sublabel: "py module", riskScore: 64 },
    { id: "code:orchestrator.py", label: "orchestrator.py", layer: "code", sublabel: "py module", riskScore: 78 },
    { id: "svc:identity-api", label: "identity-api", layer: "service", sublabel: "microservice", region: "us-east-1" },
    { id: "svc:kms-proxy", label: "kms-proxy", layer: "service", sublabel: "microservice", region: "us-east-1" },
    { id: "svc:waf-edge", label: "waf-edge", layer: "service", sublabel: "edge service", region: "global" },
    { id: "ppl:@songmin", label: "@songmin", layer: "people", sublabel: "on-call lead", onCall: true },
    { id: "ppl:@sec-team", label: "@sec-team", layer: "people", sublabel: "security team" },
    { id: "ppl:@compliance", label: "@compliance", layer: "people", sublabel: "compliance officer" },
    { id: "data:secrets_vault", label: "secrets_vault", layer: "data", sublabel: "vault kv", rowCount: 480 },
    { id: "data:audit.auth", label: "audit.auth", layer: "data", sublabel: "postgres table", rowCount: 22_000_000 },
    { id: "data:user_sessions", label: "user_sessions", layer: "data", sublabel: "redis keyspace", rowCount: 1_100_000 },
  ],
  edges: [
    { from: "code:orchestrator.py", to: "code:security.py", kind: "calls", weight: 0.7 },
    { from: "code:security.py", to: "code:auth_guard.py", kind: "calls", weight: 0.9 },
    { from: "code:security.py", to: "svc:identity-api", kind: "routes", weight: 0.95, note: "CVE-2025-0912 unpatched" },
    { from: "code:security.py", to: "svc:kms-proxy", kind: "routes", weight: 0.8 },
    { from: "code:auth_guard.py", to: "svc:waf-edge", kind: "routes", weight: 0.5 },
    { from: "code:security.py", to: "data:secrets_vault", kind: "reads", weight: 0.9 },
    { from: "code:security.py", to: "data:audit.auth", kind: "writes", weight: 0.8 },
    { from: "code:auth_guard.py", to: "data:user_sessions", kind: "reads", weight: 0.7 },
    { from: "ppl:@sec-team", to: "code:security.py", kind: "owns", weight: 1.0 },
    { from: "ppl:@compliance", to: "code:security.py", kind: "owns", weight: 0.3 },
    { from: "ppl:@songmin", to: "code:auth_guard.py", kind: "owns", weight: 0.6 },
    { from: "svc:identity-api", to: "data:audit.auth", kind: "stores", weight: 0.7 },
    { from: "svc:kms-proxy", to: "data:secrets_vault", kind: "stores", weight: 0.9 },
    { from: "svc:waf-edge", to: "data:user_sessions", kind: "stores", weight: 0.4 },
    { from: "ppl:@sec-team", to: "svc:identity-api", kind: "owns", weight: 0.8 },
    { from: "ppl:@sec-team", to: "svc:kms-proxy", kind: "owns", weight: 0.7 },
  ],
  insights: [
    {
      title: "identity-api is on CVE-2025-0912 (auth bypass) — patch available",
      detail: "security.py routes 95% of its auth checks through the vulnerable version (v2.11.3). Fix ships in v2.12.1.",
      severity: "danger",
    },
    {
      title: "secrets_vault is read on every request but never rotated",
      detail: "480 secrets, none rotated in 180+ days. Enable automatic rotation in kms-proxy.",
      severity: "warn",
    },
  ],
};

export const KNOWLEDGE_GRAPHS: Record<string, KGraph> = {
  "orchestrator.py": ORCHESTRATOR,
  "routing_policy.py": ROUTING_POLICY,
  "security.py": SECURITY,
};

export function getKnowledgeGraph(fileName: string): KGraph | null {
  return KNOWLEDGE_GRAPHS[fileName] ?? null;
}
