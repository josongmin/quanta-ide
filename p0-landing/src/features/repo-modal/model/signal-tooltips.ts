const SIGNAL_TOOLTIPS: Record<string, string> = {
  "webhook": "Chains of HTTP callbacks that propagate events across services",
  "payment": "External payment provider integrations adding failure surfaces",
  "refund": "Distinct refund lifecycle states that can conflict or duplicate",
  "retry": "Retry loops that can re-trigger side effects if not idempotent",
  "DB write": "Shared database writes across services risking race conditions",
  "ownership": "Missing documentation about who owns what code or process",
  "service": "Independently deployed services that must coordinate",
  "async": "Asynchronous messaging topics adding eventual-consistency risk",
  "queue": "Retry queues that can replay work and cause duplication",
  "protobuf": "Protocol buffer packages defining cross-service contracts",
  "hop": "Network hops in a distributed trace increasing latency and failure risk",
  "competing": "Multiple teams or services claiming ownership of the same area",
  "ranking": "Scoring signals combined to produce a final ranking",
  "scoring": "Rules that assign numeric scores to candidates or items",
  "fallback": "Fallback stages that activate when primary logic fails",
  "feature transform": "Feature engineering steps that reshape raw data for models",
  "SIMD": "Low-level vectorized code path optimized for throughput",
  "decision doc": "Missing architectural decision records for critical choices",
  "line": "Very large single-file component that is hard to reason about",
  "data hook": "Custom React hooks that fetch or manage data state",
  "cache": "Caching layers that can serve stale or inconsistent data",
  "selector": "Derived state selectors that recompute from store values",
  "modal": "Stacked modal dialogs with complex open/close state",
  "filter": "Shared filter state scattered across multiple owners",
  "DAG": "Directed acyclic graph pipelines defining task dependencies",
  "dbt": "dbt transformation models in the analytics pipeline",
  "upstream": "External data sources feeding into the pipeline",
  "table": "Critical database tables with many downstream consumers",
  "ownerless": "Transforms with no clear team ownership or documentation",
  "code style": "Inconsistent coding patterns across the codebase",
  "Terraform": "Infrastructure-as-code modules defining cloud resources",
  "cluster": "Compute clusters that host deployed workloads",
  "CI pipeline": "Continuous integration pipelines that build and test code",
  "deployed": "Services running in production environments",
  "env overlay": "Environment-specific config overrides (staging, prod, etc.)",
  "Drift": "Configuration drift between environments causing surprises",
};

export function getSignalTooltip(signal: string): string {
  for (const [keyword, description] of Object.entries(SIGNAL_TOOLTIPS)) {
    if (signal.toLowerCase().includes(keyword.toLowerCase())) {
      return description;
    }
  }
  return "Complexity indicator identified by static analysis";
}
