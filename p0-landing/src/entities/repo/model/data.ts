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

export const INCIDENTS = {
  "axios/axios": {
    color: "#ef4444",
    kind: "Supply Chain Backdoor",
    language: "JavaScript",
    desc: "North Korean state actor Sapphire Sleet hijacked the primary maintainer's npm account and published backdoored versions 1.14.1 and 0.30.4. A new dependency 'plain-crypto-js' deployed the WAVESHAPER.V2 RAT across Windows, macOS, and Linux. Axios has 100M+ weekly downloads.",
    stack: ["JavaScript", "npm", "Node.js"],
    meta: [{ k: "Downloads/wk", v: "100M+" }, { k: "Infected ver", v: "2" }, { k: "Live window", v: "3h" }, { k: "Threat actor", v: "DPRK" }],
    pain: "A single compromised maintainer account was enough to backdoor 100M+ weekly downloads. The malicious version looked identical to the legitimate one — only a new internal dependency gave it away, buried in the dependency tree.",
    outcome: "p0 diffs 1.14.0 → 1.14.1 and flags 'plain-crypto-js' immediately — zero npm history, obfuscated eval chain, OS-specific binaries, and outbound C2 beaconing on import. Maintainer email change 48h prior also surfaced as a provenance anomaly.",
    signals: ["New dep with 0 download history", "OS-specific binary payloads", "C2 beacon on require()", "Obfuscated eval chain", "Maintainer email changed 48h prior"],
    questions: [
      {
        ask: "What changed between v1.14.0 and v1.14.1?",
        answerTitle: "One new dependency rewrites the entire risk profile",
        answerSummary: "p0 diffs the dependency manifest and traces plain-crypto-js through every import chain. The package has no version history, a single anonymous maintainer, and its index.js decodes a base64 payload on first require().",
        answerBullets: ["plain-crypto-js added with no prior npm history", "index.js runs base64-decode → eval() on import", "Native binaries bundled for win32/darwin/linux"],
        stats: [{ k: "Changed files", v: "2" }, { k: "New dep age", v: "0 days" }, { k: "Eval chains", v: "3" }],
        artifacts: ["Dependency diff report", "plain-crypto-js code trace", "Eval chain map"],
      },
      {
        ask: "Where does plain-crypto-js phone home?",
        answerTitle: "C2 beacon hardcoded behind two layers of obfuscation",
        answerSummary: "p0 de-obfuscates the payload and resolves the C2 endpoint — a domain registered 6 days before the malicious publish. It beacons with hostname, platform, and process env on every Node.js startup.",
        answerBullets: ["C2 domain registered 6 days before publish", "Sends hostname + platform + env vars on startup", "Establishes persistent reverse shell on success"],
        stats: [{ k: "Obfusc. layers", v: "2" }, { k: "C2 domains", v: "1" }, { k: "Exfil fields", v: "7" }],
        artifacts: ["De-obfuscated payload", "C2 domain trace", "Exfiltration field list"],
      },
      {
        ask: "Which files execute automatically on install?",
        answerTitle: "preinstall and postinstall both fire before any code runs",
        answerSummary: "p0 maps every lifecycle hook in the dependency tree. plain-crypto-js registers both preinstall and postinstall — postinstall drops a platform-native binary and adds it to shell startup files for persistence.",
        answerBullets: ["preinstall: downloads platform binary from C2", "postinstall: persists binary in shell startup", "Binary grants persistent remote access"],
        stats: [{ k: "Lifecycle hooks", v: "2" }, { k: "Persist paths", v: "3" }, { k: "Platforms", v: "3" }],
        artifacts: ["Lifecycle hook map", "Persistence mechanism trace", "Affected startup files"],
      },
    ],
    tree: `axios/axios (v1.14.1 — backdoored)
├── lib/
│   ├── axios.js
│   └── core/dispatch.js
├── package.json              ← plain-crypto-js added here
└── node_modules/
    └── plain-crypto-js/      ← injected malicious dep
        ├── index.js           ← base64 → eval() loader
        ├── package.json       ← preinstall + postinstall
        └── native/
            ├── win32.dll      ← WAVESHAPER.V2 RAT
            ├── darwin.dylib
            └── linux.so`,
    incident: true,
    cve: "N/A",
    severity: "Critical",
    date: "2026.03",
    impact: "~3% of userbase downloaded the backdoor in a 3-hour window. RAT deployed silently across all platforms.",
  },
  "tj-actions/changed-files": {
    color: "#f97316",
    kind: "CI/CD Pipeline Attack",
    language: "TypeScript / YAML",
    desc: "An attacker repointed all version tags to a malicious commit containing a base64-encoded payload that scanned CI runner memory for credentials and dumped them to workflow logs. 23,000+ repos affected. CISA issued an emergency alert.",
    stack: ["GitHub Actions", "TypeScript", "Node.js"],
    meta: [{ k: "Repos affected", v: "23K+" }, { k: "CVE", v: "2025-30066" }, { k: "Tags modified", v: "All" }, { k: "CISA alert", v: "Yes" }],
    pain: "Every workflow using this Action by tag silently received the malicious version. No PR, no commit, no diff visible in the consuming repo — just a tag that now pointed somewhere else.",
    outcome: "p0 decodes the base64 blob, traces the /proc memory scan and credential regex writes to stdout, and flags the tag-repointing as a provenance anomaly. The upstream reviewdog compromise is also surfaced in the attack chain.",
    signals: ["Base64 payload in Action entrypoint", "Process memory scan syscalls", "Credential regex in stdout", "All tags repointed to one commit", "Upstream reviewdog compromised"],
    questions: [
      {
        ask: "What was injected into the Action entrypoint?",
        answerTitle: "Base64-encoded Node.js credential scanner hidden in dist/index.js",
        answerSummary: "p0 decodes the base64 blob and traces its execution — it spawns a child process that iterates /proc/*/environ on Linux, scanning for credential patterns matching AWS, GitHub, npm, and SSH key formats, then writes them to GITHUB_OUTPUT.",
        answerBullets: ["Base64 blob decodes to 47-line credential scanner", "Scans /proc memory for 12 credential patterns", "Writes matches to GITHUB_OUTPUT log"],
        stats: [{ k: "Cred patterns", v: "12" }, { k: "Memory regions", v: "All /proc" }, { k: "Obfusc. layers", v: "1" }],
        artifacts: ["Decoded payload source", "Credential pattern list", "Memory scan trace"],
      },
      {
        ask: "How did the attacker gain write access to the repo?",
        answerTitle: "3-hop attack chain starting from reviewdog/action-setup",
        answerSummary: "p0 reconstructs the upstream compromise: reviewdog/action-setup was compromised first, leaking a GitHub PAT with write access to the tj-actions org. That PAT was used to force-push all tags to the malicious commit 72h later.",
        answerBullets: ["reviewdog PAT leaked 72h before tj-actions hit", "PAT had write:repo scope on tj-actions org", "Force-push rewrote all tags without new commit SHA"],
        stats: [{ k: "Attack chain hops", v: "3" }, { k: "PAT scope", v: "write:repo" }, { k: "Hours between", v: "72h" }],
        artifacts: ["Attack chain graph", "PAT scope analysis", "Tag mutation timeline"],
      },
      {
        ask: "Which repos are still running the compromised Action?",
        answerTitle: "Any workflow pinned to a tag (not SHA) is still vulnerable",
        answerSummary: "p0 scans for uses: tj-actions/changed-files@v* patterns and separates SHA-pinned from mutable tag refs. Tag-pinned workflows silently received the malicious code without any visible diff in the consuming repo.",
        answerBullets: ["Tag-pinned refs: execute malicious code on next run", "SHA-pinned refs: safe (point to original commit)", "No diff visible in repo — only tag metadata changed"],
        stats: [{ k: "Tag-pinned", v: "~18K" }, { k: "SHA-pinned (safe)", v: "~5K" }, { k: "Detectable w/o p0", v: "None" }],
        artifacts: ["Affected workflow list", "Safe vs vulnerable ref report", "Remediation patch set"],
      },
    ],
    tree: `tj-actions/changed-files (2025.03.12)
├── .github/workflows/
├── action.yml              ← entrypoint → dist/index.js
├── dist/
│   └── index.js            ← base64 payload injected here
│       ├── [legitimate code]
│       └── eval(atob("...")); ← credential scanner
└── package.json
[All tags v1..v45 repointed to this commit]`,
    incident: true,
    cve: "CVE-2025-30066",
    severity: "Critical",
    date: "2025.03",
    impact: "AWS keys, GitHub PATs, npm tokens, and RSA keys leaked from CI runners across 23,000+ repos.",
  },
  "@ctrl/tinycolor": {
    color: "#a855f7",
    kind: "Self-Replicating Worm",
    language: "JavaScript",
    desc: "A self-replicating npm worm phished maintainer credentials, injected malicious post-install scripts into 500+ packages, and used stolen tokens to spread to each victim's other maintained packages. CISA issued an emergency alert.",
    stack: ["npm", "JavaScript", "Node.js"],
    meta: [{ k: "Packages hit", v: "500+" }, { k: "Maintainers", v: "350+" }, { k: "Public repos", v: "25K+" }, { k: "CISA alert", v: "Yes" }],
    pain: "The worm was self-sustaining. Each new victim's package became a new infection vector. By the time CISA issued the alert, 500+ packages had been modified and 350+ maintainer accounts had been used to spread it further.",
    outcome: "p0 flags the new postinstall script not present in prior versions, traces npm token read access, detects GitHub API calls creating public repos, and identifies the self-replication publish logic targeting the victim's other packages.",
    signals: ["New postinstall not in prior versions", "npm token read from env", "GitHub API calls in install hook", "Self-replication publish logic", "Bulk package mutations"],
    questions: [
      {
        ask: "What does the post-install script actually do?",
        answerTitle: "Four-stage payload: steal → exfil → enumerate → replicate",
        answerSummary: "p0 traces the postinstall execution: stage 1 reads npm tokens from ~/.npmrc and env vars, stage 2 exfiltrates to C2, stage 3 fetches the victim's full package list from the npm registry, stage 4 publishes infected versions of each package.",
        answerBullets: ["Stage 1: reads NPM_TOKEN, .npmrc, and CI env vars", "Stage 3: lists all packages by same maintainer", "Stage 4: publishes new patch version with worm injected"],
        stats: [{ k: "Payload stages", v: "4" }, { k: "Token sources", v: "6" }, { k: "Avg pkgs/victim", v: "3.2" }],
        artifacts: ["Postinstall execution trace", "Token harvest map", "Replication logic flow"],
      },
      {
        ask: "How does the worm avoid detection during publish?",
        answerTitle: "Minified 6-line injection into an existing file as a patch bump",
        answerSummary: "p0 byte-diffs the infected version against the prior. The worm appends 6 minified lines to an existing utility file rather than creating new files — appearing as a routine patch update, invisible to file-count anomaly detection.",
        answerBullets: ["Injects 6 minified lines into existing utility file", "Bumps patch version to appear as routine update", "No new files — bypasses file-count anomaly detection"],
        stats: [{ k: "Injected lines", v: "6" }, { k: "Version bump", v: "patch" }, { k: "New files", v: "0" }],
        artifacts: ["Byte-diff of payload", "Minification reverse trace", "Version bump history"],
      },
      {
        ask: "Which packages in my dependency tree are infected?",
        answerTitle: "p0 cross-references your lockfile against the infection timeline",
        answerSummary: "p0 checks every package in your dependency graph against the 500+ infected packages and the exact version ranges. Any version published Sep 3–11, 2025 by a compromised maintainer is flagged with a safe pin.",
        answerBullets: ["Checks all transitive deps against infection window", "Flags versions published Sep 3–11 by compromised accounts", "Provides exact safe version to pin for each affected package"],
        stats: [{ k: "Infection window", v: "9 days" }, { k: "Compromised accs", v: "350+" }, { k: "Safe pins provided", v: "All" }],
        artifacts: ["Infected dependency list", "Safe version pin report", "Compromised maintainer index"],
      },
    ],
    tree: `@ctrl/tinycolor (v4.1.3 — infected)
├── src/index.ts
├── dist/
│   └── index.js       ← worm payload appended (6 lines)
│       ├── [original tinycolor code]
│       └── // injected: steal→exfil→replicate
├── package.json       ← postinstall script added
└── .npmrc             ← read by worm for NPM_TOKEN`,
    incident: true,
    cve: "N/A",
    severity: "Critical",
    date: "2025.09",
    impact: "500+ packages infected, cloud tokens stolen, secrets exposed in 25,000+ public GitHub repos.",
  },
  "BerriAI/litellm": {
    color: "#06b6d4",
    kind: "CI/CD Chain Attack",
    language: "Python",
    desc: "Threat actor TeamPCP first compromised the Trivy security scanner, then used that foothold to backdoor LiteLLM's CI/CD pipeline. Malicious .pth files auto-execute on every Python process startup — credential stealing before any import runs. 95M+ monthly downloads.",
    stack: ["Python", "PyPI", "pip"],
    meta: [{ k: "Downloads/mo", v: "95M+" }, { k: "Cloud presence", v: "36%" }, { k: "Attack hops", v: "3" }, { k: "Infected ver", v: "2" }],
    pain: "The attack chain was: security scanner → AI framework → every downstream user. The entry point was the tool being used to protect LiteLLM. By the time it was discovered, the .pth file had been auto-executing on every Python start in affected environments.",
    outcome: "p0 flags the .pth file with executable code — Python's silent auto-run mechanism. It traces the exfiltration domain, reconstructs the 3-hop attack chain, and detects the CI/CD provenance deviation from the compromised Trivy scanner.",
    signals: [".pth file with executable code", "Auto-executes before any import", "Fake exfil domain mimics pypi.org", "CI/CD provenance deviation", "Security scanner compromised upstream"],
    questions: [
      {
        ask: "How does the .pth file execute before any import?",
        answerTitle: ".pth files are Python's silent auto-run — almost nobody audits them",
        answerSummary: "p0 explains the attack vector: Python processes every .pth file in site-packages on startup, before user code runs. litellm_init.pth contains executable Python that runs unconditionally — in subprocesses, cron jobs, and lambdas alike.",
        answerBullets: [".pth files in site-packages run at every Python startup", "Executes in all child processes, cron jobs, lambdas", "No import required — invisible to static import analysis"],
        stats: [{ k: "Trigger", v: "Every Python start" }, { k: "Scope", v: "All processes" }, { k: "Import needed", v: "No" }],
        artifacts: [".pth execution trace", "Affected process tree", "Auto-run mechanism map"],
      },
      {
        ask: "How did TeamPCP get into LiteLLM's CI pipeline?",
        answerTitle: "Trivy security scanner was the entry point — 3-hop attack chain",
        answerSummary: "p0 reconstructs the full chain: TeamPCP compromised Trivy first, injected malicious scan output that triggered a CI publish step, then used LiteLLM access to continue to Checkmarx KICS. The security tool itself was the attack vector.",
        answerBullets: ["Hop 1: Trivy compromise via maintainer credential theft", "Hop 2: Malicious scan output triggers LiteLLM CI publish", "Hop 3: LiteLLM access used to compromise KICS"],
        stats: [{ k: "Chain hops", v: "3" }, { k: "Projects hit", v: "3" }, { k: "Days undetected", v: "5" }],
        artifacts: ["Full attack chain graph", "CI pipeline exploit trace", "Trivy→LiteLLM→KICS map"],
      },
      {
        ask: "What credentials does litellm_init.pth harvest?",
        answerTitle: "Every secret in the environment — 14 cloud provider patterns",
        answerSummary: "p0 de-obfuscates the .pth payload and enumerates targets: OpenAI/Anthropic API keys, AWS/GCP/Azure credentials, GitHub tokens, database URLs, and any env var matching *_KEY, *_TOKEN, *_SECRET — exfiltrated to a domain mimicking pypi.org.",
        answerBullets: ["Targets 14 cloud provider credential patterns", "Reads all env vars matching *_KEY, *_TOKEN, *_SECRET", "Exfiltrates to fake domain mimicking pypi.org"],
        stats: [{ k: "Cred patterns", v: "14" }, { k: "Exfil dest", v: "Fake PyPI" }, { k: "Encoding", v: "base64+xor" }],
        artifacts: ["Credential harvest list", "De-obfuscated payload", "Exfil domain analysis"],
      },
    ],
    tree: `BerriAI/litellm (v1.82.7 — backdoored)
├── litellm/
│   ├── __init__.py
│   ├── main.py
│   └── utils.py
├── site-packages/
│   └── litellm_init.pth   ← auto-exec on every Python start
│       └── [14-pattern credential harvester]
└── [Published via compromised Trivy CI — bypassed review]`,
    incident: true,
    cve: "N/A",
    severity: "Critical",
    date: "2026.03",
    impact: "Credential theft from every Python process on infected systems. 95M monthly downloads, 36% cloud environment penetration.",
  },
  "langflow-ai/langflow": {
    color: "#eab308",
    kind: "Unauthenticated RCE",
    language: "Python",
    desc: "An unauthenticated API endpoint in this 79K-star AI orchestration platform passed user input directly to Python's exec() with no auth check and no sandboxing. Added to CISA's Known Exploited Vulnerabilities catalog within 5 days of disclosure.",
    stack: ["Python", "FastAPI", "Docker"],
    meta: [{ k: "GitHub stars", v: "79K+" }, { k: "CVE", v: "2025-3248" }, { k: "CVSS", v: "9.8" }, { k: "CISA KEV", v: "Yes" }],
    pain: "A dev-tooling endpoint shipped to production with zero auth. The taint path from HTTP request to exec() was 4 hops with no sanitization at any step. First exploitation attempt was 4 hours after CVE disclosure.",
    outcome: "p0 traces POST /api/v1/validate/code directly to exec() — a 4-hop taint path with zero sanitization. Flags the missing auth middleware on a code-execution endpoint as a critical finding before any CVE exists.",
    signals: ["Unauthenticated route to exec()", "Direct user input → exec() taint", "No auth middleware on /validate/code", "No sandbox or AST validation", "Dev endpoint shipped to prod"],
    questions: [
      {
        ask: "What is the exact code path from HTTP request to exec()?",
        answerTitle: "4-hop taint path — raw user input reaches exec() unmodified",
        answerSummary: "p0 traces the full call chain: POST /api/v1/validate/code → validate_code() → build_custom_component() → exec(code_string). Every hop passes the raw user-controlled string forward without modification, validation, or sandboxing.",
        answerBullets: ["POST body 'code' field flows unmodified through 4 functions", "exec() called with raw string at hop 4", "No AST parsing, no sandbox, no type checking"],
        stats: [{ k: "Taint hops", v: "4" }, { k: "Sanitization", v: "0 checks" }, { k: "Auth checks", v: "0" }],
        artifacts: ["Full taint trace", "Call chain graph", "Unprotected route report"],
      },
      {
        ask: "Why was there no auth on a code execution endpoint?",
        answerTitle: "Dev-tooling endpoint shipped to production unreviewed for 8 months",
        answerSummary: "p0 traces the commit history: /validate/code was introduced in a dev branch 8 months before disclosure. Auth middleware was applied to the parent router via decorator but this route was added outside that scope and never caught in review.",
        answerBullets: ["Endpoint introduced in dev branch 8 months prior", "Auth decorator applied to parent — not this route", "Included in production Docker image without security review"],
        stats: [{ k: "Months exposed", v: "8" }, { k: "Auth decorator", v: "Missed 1 route" }, { k: "Routes protected", v: "47 / 48" }],
        artifacts: ["Commit history trace", "Auth coverage map", "Decorator scope analysis"],
      },
      {
        ask: "How quickly was this exploited after disclosure?",
        answerTitle: "Mass exploitation within 24 hours of CVE publication",
        answerSummary: "p0 correlates the disclosure timeline with honeypot data: first exploit attempt 4h after CVE-2025-3248 was published. Mass scanning within 24h. CISA KEV listing on day 5. With p0, this would have been flagged before the CVE existed.",
        answerBullets: ["First exploit attempt: 4h after CVE disclosure", "Mass scanning: 24h after disclosure", "CISA KEV listing: day 5"],
        stats: [{ k: "Time to exploit", v: "4h" }, { k: "Time to mass scan", v: "24h" }, { k: "Days to KEV", v: "5" }],
        artifacts: ["Exploitation timeline", "Honeypot log analysis", "Pre-CVE detection report"],
      },
    ],
    tree: `langflow-ai/langflow
├── src/backend/langflow/
│   ├── api/v1/
│   │   └── validate.py       ← POST /validate/code (no auth)
│   │       └── exec(body["code"])  ← direct taint sink
│   ├── processing/process.py ← build_custom_component()
│   └── auth/middleware.py    ← never applied to /validate
└── Dockerfile`,
    incident: true,
    cve: "CVE-2025-3248",
    severity: "CVSS 9.8",
    date: "2025.05",
    impact: "Full server compromise with zero credentials. Active exploitation within 4 hours of disclosure.",
  },
  "n8n-io/n8n": {
    color: "#ec4899",
    kind: "Auth Bypass + RCE",
    language: "TypeScript",
    desc: "A CVSS 10.0 vulnerability allowed Content-Type header manipulation to bypass authentication entirely — giving unauthenticated attackers access to all secrets, admin token forgery, and arbitrary command execution. Two additional CVEs in the same release scored 9.9.",
    stack: ["TypeScript", "Node.js", "Docker"],
    meta: [{ k: "CVE", v: "2026-21858" }, { k: "CVSS", v: "10.0" }, { k: "Related CVEs", v: "2 × 9.9" }, { k: "Auth required", v: "None" }],
    pain: "The auth bypass required only a single manipulated HTTP header. Once bypassed, the Python Code Node provided direct RCE with zero sandboxing. The full chain from anonymous request to shell execution was 3 steps.",
    outcome: "p0 traces the Content-Type parser through the auth middleware and detects the unhandled branch that falls to a legacy anonymous session with admin-level defaults. The Python Code Node execution path is separately flagged as an unsandboxed RCE vector.",
    signals: ["Content-Type bypass in auth middleware", "Unhandled type → legacy admin session", "Secrets accessible without token", "Admin forgery via header", "Python Code Node unsandboxed"],
    questions: [
      {
        ask: "How does Content-Type confusion bypass authentication?",
        answerTitle: "Unhandled Content-Type falls through to legacy session with admin defaults",
        answerSummary: "p0 traces the auth middleware: when Content-Type is neither 'application/json' nor 'multipart/form-data', the parser falls to a legacy code path that skips JWT validation and creates an anonymous session — which inherits admin-level defaults from a config that was never updated.",
        answerBullets: ["Content-Type 'text/xml' hits unhandled parser branch", "Unhandled branch creates legacy anonymous session", "Legacy session inherits admin defaults from stale config"],
        stats: [{ k: "Auth branches", v: "3 (1 unhandled)" }, { k: "Unhandled types", v: "∞" }, { k: "Legacy level", v: "Admin" }],
        artifacts: ["Auth middleware flow trace", "Content-Type branch map", "Legacy session analysis"],
      },
      {
        ask: "What secrets can an unauthenticated attacker extract?",
        answerTitle: "All stored credentials — every integration token and API key",
        answerSummary: "p0 maps the secrets accessible via the bypass session: GET /credentials returns all stored integration credentials in plaintext when invoked with the legacy anonymous session. No rate limiting or audit logging triggers.",
        answerBullets: ["All stored creds returned by /credentials endpoint", "OAuth tokens, API keys, DB passwords, webhook secrets", "No rate limiting or anomaly detection triggered"],
        stats: [{ k: "Cred types", v: "All" }, { k: "Rate limit", v: "None" }, { k: "Audit log", v: "Not triggered" }],
        artifacts: ["Exposed credential list", "API endpoint trace", "Audit log gap report"],
      },
      {
        ask: "How do CVE-2026-21858 and CVE-2025-68668 chain together?",
        answerTitle: "Bypass → admin access → Python Node → shell — 3 steps, zero creds",
        answerSummary: "p0 chains both CVEs: Content-Type bypass grants admin session (CVE-2026-21858), admin session unlocks Python Code Node, and the Node executes in the n8n process without sandboxing (CVE-2025-68668) — completing the chain from anonymous to RCE.",
        answerBullets: ["Step 1: Content-Type bypass → implicit admin session", "Step 2: Admin session unlocks Python Code Node", "Step 3: Python Code Node → RCE as n8n process user"],
        stats: [{ k: "Chain steps", v: "3" }, { k: "Auth required", v: "None" }, { k: "Sandbox", v: "None" }],
        artifacts: ["Full exploit chain trace", "CVE correlation map", "RCE path diagram"],
      },
    ],
    tree: `n8n-io/n8n
├── packages/cli/src/
│   ├── middlewares/
│   │   └── auth.middleware.ts  ← Content-Type bypass here
│   ├── controllers/
│   │   └── credentials.ts      ← exposes all secrets
│   └── nodes/Code/
│       └── Code.node.ts        ← unsandboxed exec()
└── docker-compose.yml`,
    incident: true,
    cve: "CVE-2026-21858",
    severity: "CVSS 10.0",
    date: "2026.01",
    impact: "Full system takeover — all secrets, admin forgery, arbitrary RCE. Zero credentials required.",
  },
} as const satisfies Record<string, RepoData>;

export type RepoName = keyof typeof REPOS;
export const REPO_NAMES = Object.keys(REPOS) as RepoName[];
export type IncidentName = keyof typeof INCIDENTS;
export const INCIDENT_NAMES = Object.keys(INCIDENTS) as IncidentName[];
