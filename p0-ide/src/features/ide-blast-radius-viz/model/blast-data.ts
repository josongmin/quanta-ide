export interface BlastNode {
  id: string;
  label: string;
  ring: 1 | 2 | 3;
  size: 1 | 2 | 3; // visual radius
  risk: 1 | 2 | 3 | 4;
  hot?: boolean;
  tag?: string;
}

export const BLAST_NODES: BlastNode[] = [
  // ring 1 — direct callers
  { id: "fee", label: "fee.ts", ring: 1, size: 3, risk: 4, hot: true, tag: "direct" },
  { id: "webhook", label: "webhook.ts", ring: 1, size: 3, risk: 4, hot: true, tag: "direct" },
  { id: "retry", label: "retry.ts", ring: 1, size: 2, risk: 3, tag: "direct" },
  { id: "ledger", label: "ledger.ts", ring: 1, size: 2, risk: 3, tag: "direct" },
  { id: "audit", label: "audit.ts", ring: 1, size: 1, risk: 2, tag: "direct" },

  // ring 2 — transitive
  { id: "billing", label: "billing.ts", ring: 2, size: 2, risk: 3, hot: true },
  { id: "report", label: "report.ts", ring: 2, size: 2, risk: 2 },
  { id: "queue", label: "queue.ts", ring: 2, size: 2, risk: 3 },
  { id: "session", label: "session.ts", ring: 2, size: 1, risk: 2 },
  { id: "metrics", label: "metrics.ts", ring: 2, size: 1, risk: 1 },
  { id: "notify", label: "notify.ts", ring: 2, size: 1, risk: 2 },
  { id: "sync", label: "sync.ts", ring: 2, size: 2, risk: 3 },
  { id: "cache", label: "cache.ts", ring: 2, size: 1, risk: 1 },
  { id: "lock", label: "lock.ts", ring: 2, size: 1, risk: 2 },
  { id: "dispatch", label: "dispatch.ts", ring: 2, size: 2, risk: 3 },

  // ring 3 — distant
  { id: "log", label: "log.ts", ring: 3, size: 1, risk: 1 },
  { id: "stats", label: "stats.ts", ring: 3, size: 1, risk: 1 },
  { id: "trace", label: "trace.ts", ring: 3, size: 1, risk: 1 },
  { id: "schema", label: "schema.ts", ring: 3, size: 1, risk: 2 },
  { id: "consumer", label: "consumer.ts", ring: 3, size: 1, risk: 2 },
  { id: "pipeline", label: "pipeline.ts", ring: 3, size: 1, risk: 2 },
  { id: "rate", label: "rate.ts", ring: 3, size: 1, risk: 1 },
  { id: "fanout", label: "fanout.ts", ring: 3, size: 1, risk: 2 },
  { id: "router", label: "router.ts", ring: 3, size: 1, risk: 1 },
  { id: "etl", label: "etl.ts", ring: 3, size: 1, risk: 2 },
  { id: "guard", label: "guard.ts", ring: 3, size: 1, risk: 2 },
  { id: "mailer", label: "mailer.ts", ring: 3, size: 1, risk: 1 },
  { id: "feed", label: "feed.ts", ring: 3, size: 1, risk: 1 },
  { id: "loader", label: "loader.ts", ring: 3, size: 1, risk: 1 },
  { id: "store", label: "store.ts", ring: 3, size: 1, risk: 1 },
  { id: "tracker", label: "tracker.ts", ring: 3, size: 1, risk: 1 },
];
