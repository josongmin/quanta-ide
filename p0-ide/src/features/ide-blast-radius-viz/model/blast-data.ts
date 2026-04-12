export interface BlastSymbol {
  name: string;
  kind: "function" | "class" | "type" | "const" | "method";
  risk: 1 | 2 | 3 | 4;
}

export interface BlastNode {
  id: string;
  label: string;
  hop: 1 | 2 | 3;
  risk: 1 | 2 | 3 | 4;
  hot?: boolean;
  coupling: number;
  symbols: BlastSymbol[];
}

/* ── Per-file blast data ───────────────────────────────────────────── */

const BLAST_ORCHESTRATOR: BlastNode[] = [
  { id: "fee", label: "fee.ts", hop: 1, risk: 4, hot: true, coupling: 0.92, symbols: [
    { name: "calculateFee", kind: "function", risk: 4 },
    { name: "validateFeeRule", kind: "function", risk: 3 },
    { name: "FeeConfig", kind: "type", risk: 2 },
  ]},
  { id: "webhook", label: "webhook.ts", hop: 1, risk: 4, hot: true, coupling: 0.88, symbols: [
    { name: "dispatchWebhook", kind: "function", risk: 4 },
    { name: "retryPolicy", kind: "const", risk: 3 },
  ]},
  { id: "retry", label: "retry.ts", hop: 1, risk: 3, coupling: 0.71, symbols: [
    { name: "RetryScheduler", kind: "class", risk: 3 },
    { name: "backoff", kind: "function", risk: 2 },
    { name: "MAX_RETRIES", kind: "const", risk: 1 },
  ]},
  { id: "ledger", label: "ledger.ts", hop: 1, risk: 3, coupling: 0.65, symbols: [
    { name: "postEntry", kind: "function", risk: 3 },
    { name: "reconcile", kind: "function", risk: 3 },
  ]},
  { id: "audit", label: "audit.ts", hop: 1, risk: 2, coupling: 0.40, symbols: [
    { name: "logAuditEvent", kind: "function", risk: 2 },
  ]},
  { id: "billing", label: "billing.ts", hop: 2, risk: 3, hot: true, coupling: 0.62, symbols: [
    { name: "chargeCycle", kind: "function", risk: 3 },
  ]},
  { id: "queue", label: "queue.ts", hop: 2, risk: 3, coupling: 0.55, symbols: [
    { name: "enqueue", kind: "function", risk: 3 },
  ]},
  { id: "sync", label: "sync.ts", hop: 2, risk: 3, coupling: 0.52, symbols: [{ name: "syncState", kind: "function", risk: 3 }] },
  { id: "dispatch", label: "dispatch.ts", hop: 2, risk: 3, coupling: 0.48, symbols: [{ name: "routeEvent", kind: "function", risk: 3 }] },
  { id: "report", label: "report.ts", hop: 2, risk: 2, coupling: 0.35, symbols: [{ name: "generateReport", kind: "function", risk: 2 }] },
  { id: "session", label: "session.ts", hop: 2, risk: 2, coupling: 0.30, symbols: [{ name: "refreshSession", kind: "function", risk: 2 }] },
  { id: "notify", label: "notify.ts", hop: 2, risk: 2, coupling: 0.28, symbols: [{ name: "sendNotification", kind: "function", risk: 2 }] },
  { id: "lock", label: "lock.ts", hop: 2, risk: 2, coupling: 0.25, symbols: [{ name: "acquireLock", kind: "function", risk: 2 }] },
  { id: "metrics", label: "metrics.ts", hop: 2, risk: 1, coupling: 0.15, symbols: [{ name: "recordMetric", kind: "function", risk: 1 }] },
  { id: "cache", label: "cache.ts", hop: 2, risk: 1, coupling: 0.12, symbols: [{ name: "invalidate", kind: "function", risk: 1 }] },
  { id: "schema", label: "schema.ts", hop: 3, risk: 2, coupling: 0.22, symbols: [{ name: "PaymentSchema", kind: "type", risk: 2 }] },
  { id: "consumer", label: "consumer.ts", hop: 3, risk: 2, coupling: 0.20, symbols: [{ name: "consume", kind: "function", risk: 2 }] },
  { id: "pipeline", label: "pipeline.ts", hop: 3, risk: 2, coupling: 0.18, symbols: [{ name: "runPipeline", kind: "function", risk: 2 }] },
  { id: "fanout", label: "fanout.ts", hop: 3, risk: 2, coupling: 0.16, symbols: [{ name: "fanoutEvent", kind: "function", risk: 2 }] },
  { id: "guard", label: "guard.ts", hop: 3, risk: 2, coupling: 0.14, symbols: [{ name: "checkGuard", kind: "function", risk: 2 }] },
  { id: "etl", label: "etl.ts", hop: 3, risk: 2, coupling: 0.13, symbols: [{ name: "extractTransformLoad", kind: "function", risk: 2 }] },
  { id: "log", label: "log.ts", hop: 3, risk: 1, coupling: 0.10, symbols: [{ name: "log", kind: "function", risk: 1 }] },
  { id: "stats", label: "stats.ts", hop: 3, risk: 1, coupling: 0.09, symbols: [{ name: "aggregate", kind: "function", risk: 1 }] },
  { id: "trace", label: "trace.ts", hop: 3, risk: 1, coupling: 0.08, symbols: [{ name: "startSpan", kind: "function", risk: 1 }] },
  { id: "rate", label: "rate.ts", hop: 3, risk: 1, coupling: 0.07, symbols: [{ name: "checkRate", kind: "function", risk: 1 }] },
  { id: "router", label: "router.ts", hop: 3, risk: 1, coupling: 0.06, symbols: [{ name: "route", kind: "function", risk: 1 }] },
  { id: "mailer", label: "mailer.ts", hop: 3, risk: 1, coupling: 0.05, symbols: [{ name: "sendMail", kind: "function", risk: 1 }] },
  { id: "feed", label: "feed.ts", hop: 3, risk: 1, coupling: 0.04, symbols: [{ name: "publish", kind: "function", risk: 1 }] },
  { id: "loader", label: "loader.ts", hop: 3, risk: 1, coupling: 0.04, symbols: [{ name: "loadConfig", kind: "function", risk: 1 }] },
  { id: "store", label: "store.ts", hop: 3, risk: 1, coupling: 0.03, symbols: [{ name: "persist", kind: "function", risk: 1 }] },
  { id: "tracker", label: "tracker.ts", hop: 3, risk: 1, coupling: 0.02, symbols: [{ name: "track", kind: "function", risk: 1 }] },
];

const BLAST_ROUTING: BlastNode[] = [
  { id: "gw", label: "gateway.py", hop: 1, risk: 3, coupling: 0.72, symbols: [{ name: "forwardRequest", kind: "function", risk: 3 }] },
  { id: "lb", label: "loadbalancer.py", hop: 1, risk: 2, coupling: 0.55, symbols: [{ name: "selectTarget", kind: "function", risk: 2 }] },
  { id: "metrics", label: "metrics.ts", hop: 2, risk: 1, coupling: 0.20, symbols: [{ name: "recordLatency", kind: "function", risk: 1 }] },
  { id: "cache", label: "cache.ts", hop: 2, risk: 1, coupling: 0.15, symbols: [{ name: "routeCache", kind: "function", risk: 1 }] },
  { id: "log", label: "log.ts", hop: 3, risk: 1, coupling: 0.08, symbols: [{ name: "log", kind: "function", risk: 1 }] },
];

const BLAST_SECURITY: BlastNode[] = [
  { id: "scanner", label: "scanner.py", hop: 1, risk: 4, hot: true, coupling: 0.85, symbols: [
    { name: "runSemgrep", kind: "function", risk: 4 },
    { name: "parseSarifOutput", kind: "function", risk: 3 },
  ]},
  { id: "reporter", label: "reporter.py", hop: 1, risk: 3, coupling: 0.60, symbols: [{ name: "formatFindings", kind: "function", risk: 3 }] },
  { id: "config", label: "taint_config.yaml", hop: 1, risk: 2, coupling: 0.40, symbols: [{ name: "TaintRuleSet", kind: "type", risk: 2 }] },
  { id: "ci", label: "ci_gate.py", hop: 2, risk: 3, hot: true, coupling: 0.55, symbols: [{ name: "blockMerge", kind: "function", risk: 3 }] },
  { id: "notify", label: "slack_notify.py", hop: 2, risk: 1, coupling: 0.18, symbols: [{ name: "alertChannel", kind: "function", risk: 1 }] },
  { id: "db", label: "findings_db.py", hop: 2, risk: 2, coupling: 0.35, symbols: [{ name: "persistFinding", kind: "function", risk: 2 }] },
  { id: "dash", label: "dashboard.ts", hop: 3, risk: 1, coupling: 0.12, symbols: [{ name: "renderChart", kind: "function", risk: 1 }] },
];

const BLAST_AUDIT: BlastNode[] = [
  { id: "handler", label: "handler.py", hop: 1, risk: 2, coupling: 0.50, symbols: [{ name: "processEvent", kind: "function", risk: 2 }] },
  { id: "queue", label: "queue.ts", hop: 2, risk: 1, coupling: 0.20, symbols: [{ name: "enqueue", kind: "function", risk: 1 }] },
  { id: "log", label: "log.ts", hop: 2, risk: 1, coupling: 0.10, symbols: [{ name: "log", kind: "function", risk: 1 }] },
];

const BLAST_BY_FILE: Record<string, BlastNode[]> = {
  "orchestrator.py": BLAST_ORCHESTRATOR,
  "routing_policy.py": BLAST_ROUTING,
  "security.py": BLAST_SECURITY,
  "audit_store.py": BLAST_AUDIT,
};

export function getBlastNodes(fileName: string): BlastNode[] {
  return BLAST_BY_FILE[fileName] ?? BLAST_ORCHESTRATOR;
}

/** @deprecated Use getBlastNodes instead */
export const BLAST_NODES = BLAST_ORCHESTRATOR;
