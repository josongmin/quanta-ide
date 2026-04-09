import type { RepoData } from "./types";

export const REPOS = {
  "acme/payments-api": {
    color: "#a78bfa",
    kind: "Legacy Monolith",
    language: "TypeScript",
    desc: "Production payment backend with webhook retries, adapter sprawl, and a refund path nobody wants to debug by hand.",
    stack: ["TypeScript", "Node.js", "Fastify", "PostgreSQL", "Redis"],
    meta: [{ k: "Files", v: "1,284" }, { k: "Lines", v: "92.4k" }, { k: "Deps", v: "47" }, { k: "Age", v: "5y" }],
    pain: "Refund state is split across routes, adapters, ledger writes, and webhook retries. The hard part is not reading code. It is reconstructing the real transaction lifecycle without trusting any single file to tell the truth.",
    outcome: "p0 traces the payment lifecycle end to end, isolates duplicate state transitions, and shows which files are most likely to cause a silent double-refund or a stuck payout.",
    signals: ["14-file webhook chain", "3 payment providers", "7 refund states", "2 retry loops", "9 shared DB writes", "No ownership docs"],
    questions: [
      {
        ask: "Which path can double-refund a customer?",
        answerTitle: "Duplicate refund path across PayPal retry + ledger replay",
        answerSummary: "p0 follows the same refund intent through webhook ingestion, idempotency storage, and ledger reconciliation to show where replay protection quietly disappears.",
        answerBullets: ["Highlights the branch where the idempotency key is dropped", "Shows the ledger write that can be reached twice", "Ranks the three files most likely to own the bug"],
        stats: [{ k: "Trace hops", v: "14" }, { k: "Risk score", v: "0.92" }, { k: "Writers", v: "6" }],
        artifacts: ["Transaction path graph", "Conflicting state writer list", "Top 3 risky files"],
      },
      {
        ask: "Who actually owns refund state?",
        answerTitle: "Refund ownership is split across route, service, and ledger layers",
        answerSummary: "p0 maps every write and read of refund status, then marks the canonical transition boundary instead of leaving ownership as tribal knowledge.",
        answerBullets: ["Builds a state-transition map", "Flags conflicting writers", "Explains which module should become source of truth"],
        stats: [{ k: "State writes", v: "19" }, { k: "Owner candidates", v: "3" }, { k: "Conflicts", v: "5" }],
        artifacts: ["Refund state diagram", "Write-read ownership map", "Suggested source-of-truth boundary"],
      },
      {
        ask: "What breaks if webhook ordering changes?",
        answerTitle: "Ordering change impacts reconciliation and async retries downstream",
        answerSummary: "p0 computes blast radius from the webhook entrypoint through queue consumers and persistence layers so you can see which consumers depend on the current order.",
        answerBullets: ["Lists downstream handlers", "Shows order-sensitive checks", "Surfaces tests that no longer cover reality"],
        stats: [{ k: "Consumers", v: "9" }, { k: "Order checks", v: "7" }, { k: "Tests stale", v: "4" }],
        artifacts: ["Blast radius map", "Ordering assumptions list", "Coverage gap report"],
      },
    ],
    tree: `acme/payments-api
├── src/
│   ├── routes/
│   │   ├── webhooks.ts
│   │   └── refunds.ts
│   ├── adapters/
│   │   ├── stripe.ts
│   │   └── paypal.ts
│   ├── services/
│   │   ├── refund-engine.ts
│   │   └── idempotency.ts
│   └── db/
│       └── ledger.ts
├── tests/
└── package.json`,
  },
  "switchyard/event-mesh": {
    color: "#fb7185",
    kind: "Distributed MSA",
    language: "Go",
    desc: "An event-driven commerce mesh with Kafka, SQS, gRPC, and all the cross-service ambiguity that makes incidents expensive.",
    stack: ["Go", "Kafka", "gRPC", "Postgres", "OpenTelemetry"],
    meta: [{ k: "Services", v: "23" }, { k: "Topics", v: "41" }, { k: "Lines", v: "187k" }, { k: "Hops", v: "19" }],
    pain: "The bug never lives in one service. Real work means tracing message schemas, retries, dead letters, and fallback consumers across teams that all believe someone else owns the failure.",
    outcome: "p0 builds the cross-service path, shows where duplication or dead-lettering can fork state, and pinpoints which services must change together before a rollout is safe.",
    signals: ["23 services", "41 async topics", "5 retry queues", "12 protobuf packages", "19-hop trace", "3 competing owners"],
    questions: [
      {
        ask: "Where can one checkout event charge twice?",
        answerTitle: "Charge duplication starts at replay into billing-confirmed fanout",
        answerSummary: "p0 correlates publisher retry logic with downstream idempotency checks and isolates the hop where the same event can re-enter billing.",
        answerBullets: ["Shows the producer retry branch", "Names the consumer without dedupe protection", "Maps the exact services touched by the duplicate path"],
        stats: [{ k: "Service hops", v: "19" }, { k: "Dup paths", v: "2" }, { k: "Unsafe consumers", v: "1" }],
        artifacts: ["Cross-service event trace", "Duplicate delivery path", "Patch set ownership list"],
      },
      {
        ask: "Which services still depend on the old event schema?",
        answerTitle: "Schema blast radius spans sync and async consumers",
        answerSummary: "p0 compares producers, topic subscribers, generated types, and transform layers so you can change the schema without waiting for a production surprise.",
        answerBullets: ["Lists direct subscribers", "Catches transitive transforms", "Separates hard failures from silent data drift"],
        stats: [{ k: "Subscribers", v: "11" }, { k: "Transforms", v: "7" }, { k: "Hard breaks", v: "4" }],
        artifacts: ["Schema dependency graph", "Transitive consumer list", "Safe rollout order"],
      },
      {
        ask: "What is the real source of truth for order status?",
        answerTitle: "Order status is effectively owned by three services, not one",
        answerSummary: "p0 reconstructs every status write and marks which one is authoritative versus merely cached, derived, or compensating.",
        answerBullets: ["Shows conflicting writers", "Highlights lagging projections", "Suggests the safest place to enforce invariants"],
        stats: [{ k: "Status writers", v: "8" }, { k: "Caches", v: "4" }, { k: "Lagging reads", v: "3" }],
        artifacts: ["Order state ownership map", "Projection lag report", "Invariant enforcement plan"],
      },
    ],
    tree: `switchyard/event-mesh
├── services/
│   ├── checkout/
│   ├── billing/
│   ├── risk/
│   ├── ledger/
│   └── notifications/
├── proto/
├── topics/
├── internal/
└── deploy/`,
  },
  "lattice/ranking-engine": {
    color: "#38bdf8",
    kind: "Algorithm-Heavy Core",
    language: "Rust + Python",
    desc: "A ranking engine full of scoring rules, vector features, and enough hidden coupling to make every optimization feel dangerous.",
    stack: ["Rust", "Python", "SIMD", "Feature Store", "Parquet"],
    meta: [{ k: "Modules", v: "87" }, { k: "Signals", v: "146" }, { k: "Lines", v: "131k" }, { k: "Rules", v: "312" }],
    pain: "The painful part is not locating code. It is understanding which scoring term dominates, which fallback path wins, and which feature transform silently changes top-k output when you adjust one weight.",
    outcome: "p0 untangles the ranking pipeline, identifies the decisive scoring branches, and explains which rule sets or feature transforms actually move results.",
    signals: ["146 ranking signals", "312 scoring rules", "4 fallback stages", "17 feature transforms", "SIMD hot path", "Zero decision docs"],
    questions: [
      {
        ask: "Why did CTR drop after this scoring tweak?",
        answerTitle: "A fallback boost started overpowering the intended weight change",
        answerSummary: "p0 traces the exact scoring composition, compares weights before and after the tweak, and identifies the later-stage normalization that erased the expected gain.",
        answerBullets: ["Ranks dominant terms in the final score", "Shows the normalization stage that swamps the tweak", "Points to the narrowest safe fix"],
        stats: [{ k: "Score terms", v: "27" }, { k: "Dominant boosts", v: "3" }, { k: "Regressed stages", v: "1" }],
        artifacts: ["Score composition trace", "Dominant term ranking", "Minimal fix plan"],
      },
      {
        ask: "Which feature transforms affect cold-start ranking?",
        answerTitle: "Cold-start ranking is shaped by three upstream feature branches",
        answerSummary: "p0 narrows a huge feature graph into the transforms that still apply when user history is missing, so you can tune cold-start behavior without touching the full engine.",
        answerBullets: ["Filters out history-dependent branches", "Maps the fallback scoring path", "Lists the modules with highest leverage"],
        stats: [{ k: "Active transforms", v: "3" }, { k: "Cold paths", v: "5" }, { k: "High leverage", v: "4" }],
        artifacts: ["Cold-start feature graph", "Fallback scoring path", "High-leverage modules"],
      },
      {
        ask: "What breaks if we remove this heuristic?",
        answerTitle: "Heuristic removal changes two rerankers and one tie-break path",
        answerSummary: "p0 computes the blast radius of a heuristic through compile-time references and runtime composition points, then separates correctness risk from ranking quality risk.",
        answerBullets: ["Finds direct code dependencies", "Surfaces hidden runtime registrations", "Explains which tests miss ranking regressions"],
        stats: [{ k: "Refs", v: "12" }, { k: "Runtime hooks", v: "4" }, { k: "Tests blind", v: "6" }],
        artifacts: ["Heuristic dependency map", "Runtime registration list", "Risk split by failure mode"],
      },
    ],
    tree: `lattice/ranking-engine
├── crates/
│   ├── scorer/
│   ├── retrieval/
│   ├── rerank/
│   └── features/
├── pipelines/
├── experiments/
└── benches/`,
  },
  "orbit/web-dashboard": {
    color: "#60a5fa",
    kind: "Frontend State Jungle",
    language: "TypeScript",
    desc: "A React analytics surface with shared filters, duplicated cache assumptions, and one page that slowly became its own platform.",
    stack: ["React 18", "TypeScript", "Vite", "TanStack Query", "Zustand"],
    meta: [{ k: "Files", v: "412" }, { k: "Components", v: "38" }, { k: "Lines", v: "34.1k" }, { k: "Deps", v: "31" }],
    pain: "Every visible bug spans UI, derived state, and caching. The page looks manageable until one filter or optimistic update mutates a shape that three other panels quietly depend on.",
    outcome: "p0 reads the component graph, tracks state ownership, and marks the cache or prop boundaries most likely to create stale views, duplicated fetches, or impossible refactors.",
    signals: ["1,212-line OrdersTable", "6 data hooks", "3 cache layers", "11 derived selectors", "4 modal stacks", "Shared filters everywhere"],
    questions: [
      {
        ask: "Where does filters state really live?",
        answerTitle: "Filter ownership is split between URL state, store state, and query params",
        answerSummary: "p0 maps how the same filter concept moves through components and hooks so you can see the one place that should own it.",
        answerBullets: ["Tracks state propagation across hooks", "Flags duplicate derivations", "Shows the clean extraction seam"],
        stats: [{ k: "Owners", v: "3" }, { k: "Derived nodes", v: "11" }, { k: "Leaks", v: "4" }],
        artifacts: ["Filter ownership graph", "Duplicate derivation list", "Refactor seam suggestion"],
      },
      {
        ask: "Why does OrdersTable rerender so much?",
        answerTitle: "Two selectors and one inline transform fan out unnecessary rerenders",
        answerSummary: "p0 isolates the state subscriptions and data shaping paths that rebuild props on every interaction, even when the table data itself has not changed.",
        answerBullets: ["Highlights hot render triggers", "Marks unstable prop sources", "Suggests the lowest-risk split points"],
        stats: [{ k: "Render triggers", v: "9" }, { k: "Hot selectors", v: "2" }, { k: "Split seams", v: "3" }],
        artifacts: ["Render trigger heatmap", "Prop stability report", "Suggested component split"],
      },
      {
        ask: "What can we delete without breaking the dashboard?",
        answerTitle: "Unused UI pieces still leak through stale imports and dead query hooks",
        answerSummary: "p0 combines reference analysis with route and render reachability to separate truly dead code from features that are just hard to find.",
        answerBullets: ["Lists unreachable components", "Finds imports with no runtime path", "Flags deceptive false positives"],
        stats: [{ k: "Dead comps", v: "7" }, { k: "Dead hooks", v: "3" }, { k: "False positives", v: "2" }],
        artifacts: ["Reachability report", "Dead import list", "Safe delete batch"],
      },
    ],
    tree: `orbit/web-dashboard
├── src/
│   ├── pages/
│   │   ├── Overview.tsx
│   │   └── Orders.tsx
│   ├── components/
│   │   ├── OrdersTable.tsx
│   │   ├── Filters.tsx
│   │   └── charts/
│   ├── hooks/
│   │   └── useOrders.ts
│   └── store/
├── public/
└── vite.config.ts`,
  },
  "kettle/data-pipeline": {
    color: "#86efac",
    kind: "Data Lineage Maze",
    language: "Python",
    desc: "A 5-year-old ETL platform with Airflow, dbt, and enough lineage ambiguity to make one column change feel like a roulette spin.",
    stack: ["Python 3.11", "Airflow", "dbt", "Snowflake", "Pandas"],
    meta: [{ k: "DAGs", v: "47" }, { k: "Models", v: "128" }, { k: "Lines", v: "61.7k" }, { k: "Deps", v: "19" }],
    pain: "The scary part is hidden coupling: a staging column becomes a mart field, becomes a dashboard dependency, becomes a weekly incident. Nobody wants to trace that by hand.",
    outcome: "p0 reconstructs lineage across DAGs, models, and transforms so you can see what depends on a table, a column, or an ingestion job before you touch production.",
    signals: ["47 DAGs", "128 dbt models", "9 upstream sources", "26 critical tables", "13 ownerless transforms", "3 code styles"],
    questions: [
      {
        ask: "Which DAGs touch the users table?",
        answerTitle: "Users lineage spans ingestion, enrichment, marts, and exports",
        answerSummary: "p0 walks scheduler definitions, SQL models, and Python transforms to build the real dependency graph around the users table.",
        answerBullets: ["Lists direct DAG owners", "Finds downstream marts", "Marks the least obvious consumers"],
        stats: [{ k: "Direct DAGs", v: "6" }, { k: "Downstream marts", v: "9" }, { k: "Hidden consumers", v: "3" }],
        artifacts: ["Table lineage map", "Owner DAG list", "Consumer dependency report"],
      },
      {
        ask: "What breaks if we drop email_v2?",
        answerTitle: "email_v2 removal hits marts, experiments, and one hidden export",
        answerSummary: "p0 computes column-level blast radius instead of table-level guesses, which is the difference between a clean deprecation and a broken analytics week.",
        answerBullets: ["Finds compiled SQL references", "Flags runtime dataframe usage", "Separates hard failures from data quality drift"],
        stats: [{ k: "Column refs", v: "17" }, { k: "Hard breaks", v: "5" }, { k: "Silent drift", v: "4" }],
        artifacts: ["Column blast radius", "SQL + Python usage list", "Deprecation rollout plan"],
      },
      {
        ask: "Why is this pipeline taking 3x longer?",
        answerTitle: "A staging fanout introduced a wide-table bottleneck",
        answerSummary: "p0 identifies the transform branch and downstream materializations most likely to magnify row counts or force expensive re-computation.",
        answerBullets: ["Highlights row explosion points", "Names expensive joins", "Shows the narrowest optimization target"],
        stats: [{ k: "Explosion points", v: "2" }, { k: "Heavy joins", v: "4" }, { k: "Cheap wins", v: "1" }],
        artifacts: ["Runtime bottleneck map", "Wide-table branch trace", "Optimization target shortlist"],
      },
    ],
    tree: `kettle/data-pipeline
├── dags/
│   ├── ingest/
│   │   ├── users_v2.py
│   │   └── events.py
│   ├── transform/
│   │   └── enrich_orders.py
│   └── export/
├── dbt/
│   ├── models/
│   │   ├── staging/
│   │   └── marts/
│   └── dbt_project.yml
└── airflow.cfg`,
  },
  "atlas/platform-infra": {
    color: "#f59e0b",
    kind: "Infra + IaC Sprawl",
    language: "Terraform + YAML",
    desc: "A platform repo full of Terraform modules, Helm charts, GitHub Actions, and enough environment drift to make one rollout feel like a bet.",
    stack: ["Terraform", "Helm", "Kubernetes", "GitHub Actions", "YAML"],
    meta: [{ k: "Modules", v: "64" }, { k: "Clusters", v: "12" }, { k: "Pipelines", v: "29" }, { k: "Services", v: "57" }],
    pain: "Infra changes fail quietly until they do not. The difficult part is understanding which module, chart, or workflow actually controls a given service in a given environment.",
    outcome: "p0 resolves ownership across IaC modules, environments, and deployment workflows so you can answer what a change touches before apply time.",
    signals: ["64 Terraform modules", "12 clusters", "29 CI pipelines", "57 deployed services", "4 env overlays", "Drift in staging + prod"],
    questions: [
      {
        ask: "Which config owns this service in prod?",
        answerTitle: "Production ownership spans Terraform, Helm values, and one deploy workflow",
        answerSummary: "p0 follows the service through module composition and environment overlays to show which file actually wins in production.",
        answerBullets: ["Separates declared vs effective config", "Finds environment-specific overrides", "Pinpoints the deploy workflow that applies them"],
        stats: [{ k: "Owners", v: "3" }, { k: "Overrides", v: "6" }, { k: "Deploy gates", v: "2" }],
        artifacts: ["Effective config map", "Override diff", "Owning workflow chain"],
      },
      {
        ask: "What breaks if we rotate this secret path?",
        answerTitle: "Secret path change impacts workloads, jobs, and CI consumers",
        answerSummary: "p0 maps secret usage through templates, manifests, and automation scripts so you see the full blast radius before rotating credentials.",
        answerBullets: ["Lists direct manifest consumers", "Finds CI references", "Flags mismatched fallback env vars"],
        stats: [{ k: "Consumers", v: "14" }, { k: "CI refs", v: "5" }, { k: "Fallback vars", v: "3" }],
        artifacts: ["Secret usage map", "CI consumer list", "Rotation checklist"],
      },
      {
        ask: "Why is staging drifting from prod?",
        answerTitle: "A stale overlay and skipped workflow gate created config drift",
        answerSummary: "p0 compares environment overlays and deployment gates to show the exact path that let staging and production diverge.",
        answerBullets: ["Highlights overlay mismatches", "Surfaces skipped rollout checks", "Shows the minimal sync plan"],
        stats: [{ k: "Drift items", v: "8" }, { k: "Skipped gates", v: "1" }, { k: "Sync steps", v: "4" }],
        artifacts: ["Overlay diff report", "Workflow gate audit", "Minimal sync plan"],
      },
    ],
    tree: `atlas/platform-infra
├── terraform/
│   ├── modules/
│   ├── prod/
│   └── staging/
├── helm/
│   ├── charts/
│   └── values/
├── .github/workflows/
└── scripts/`,
  },
} as const satisfies Record<string, RepoData>;

export type RepoName = keyof typeof REPOS;
export const REPO_NAMES = Object.keys(REPOS) as RepoName[];
