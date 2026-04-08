import type { RepoData } from "./types";

export const REPOS = {
  "acme/payments-api": {
    color: "#a78bfa",
    desc: "Production Node.js payment gateway with Stripe + PayPal adapters, idempotent webhooks, and a 5-year-old refund flow that no one trusts.",
    stack: ["TypeScript", "Node.js", "Fastify", "PostgreSQL", "Redis"],
    meta: [{ k: "Files", v: "1,284" }, { k: "Lines", v: "92.4k" }, { k: "Tokens", v: "318k" }, { k: "Age", v: "5y" }],
    scenario: "A real legacy backend with a silent refund bug. Watch p0 trace the webhook chain across 14 files and pinpoint the race condition.",
    seeds: ["Why is the refund webhook flaky?", "Map the auth flow end to end", "List the top 3 risky files"],
    tree: `acme/payments-api\n├── src/\n│   ├── routes/\n│   │   ├── webhooks.ts\n│   │   └── refunds.ts\n│   ├── adapters/\n│   │   ├── stripe.ts\n│   │   └── paypal.ts\n│   ├── services/\n│   │   ├── refund-engine.ts\n│   │   └── idempotency.ts\n│   └── db/\n│       └── ledger.ts\n├── tests/\n└── package.json`,
  },
  "orbit/web-dashboard": {
    color: "#60a5fa",
    desc: "A React analytics dashboard with 38 components, 6 data hooks, and one <OrdersTable/> that has quietly grown to 1,200 lines.",
    stack: ["React 18", "TypeScript", "Vite", "TanStack Query", "Zustand"],
    meta: [{ k: "Files", v: "412" }, { k: "Components", v: "38" }, { k: "Lines", v: "34.1k" }, { k: "Tokens", v: "128k" }],
    scenario: "A tangled frontend that begs to be split. p0 reads the component graph, finds shared state leaks, and proposes a refactor that compiles.",
    seeds: ["Where does Filters state live?", "Refactor <OrdersTable/> into smaller pieces", "Find unused components"],
    tree: `orbit/web-dashboard\n├── src/\n│   ├── pages/\n│   │   ├── Overview.tsx\n│   │   └── Orders.tsx\n│   ├── components/\n│   │   ├── OrdersTable.tsx  ⚠ 1,212 ln\n│   │   ├── Filters.tsx\n│   │   └── charts/\n│   ├── hooks/\n│   │   └── useOrders.ts\n│   └── store/\n├── public/\n└── vite.config.ts`,
  },
  "kettle/data-pipeline": {
    color: "#86efac",
    desc: "A 5-year-old Python ETL pipeline with 47 DAGs, three generations of code style, and exactly zero people who remember how the users table got there.",
    stack: ["Python 3.11", "Airflow", "dbt", "Snowflake", "Pandas"],
    meta: [{ k: "DAGs", v: "47" }, { k: "Models", v: "128" }, { k: "Lines", v: "61.7k" }, { k: "Tokens", v: "244k" }],
    scenario: 'Code archaeology. p0 walks the dependency graph and answers "what breaks if I drop this column?" before you find out the hard way.',
    seeds: ["Walk me through the ingestion stage", "Which DAGs touch the users table?", "What breaks if I drop column email_v2?"],
    tree: `kettle/data-pipeline\n├── dags/\n│   ├── ingest/\n│   │   ├── users_v2.py\n│   │   └── events.py\n│   ├── transform/\n│   │   └── enrich_orders.py\n│   └── export/\n├── dbt/\n│   ├── models/\n│   │   ├── staging/\n│   │   └── marts/\n│   └── dbt_project.yml\n└── airflow.cfg`,
  },
  "forge/checkout-saas": {
    color: "#fbbf24",
    desc: "A Next.js SaaS boilerplate with auth, billing skeleton, and a checkout flow waiting for its third pricing tier.",
    stack: ["Next.js 14", "TypeScript", "Prisma", "Stripe", "Tailwind"],
    meta: [{ k: "Routes", v: "32" }, { k: "Models", v: "14" }, { k: "Lines", v: "21.3k" }, { k: "Tokens", v: "94k" }],
    scenario: "Greenfield-ish. p0 reads the billing seams, plans the schema diff, and writes the new tier end to end.",
    seeds: ["Add a Stripe subscription tier", "Wire email receipts after checkout", "Where would I add an admin route?"],
    tree: `forge/checkout-saas\n├── app/\n│   ├── (marketing)/\n│   ├── (app)/\n│   │   ├── dashboard/\n│   │   └── billing/\n│   └── api/\n│       └── stripe/\n│           └── webhook/route.ts\n├── lib/\n│   ├── stripe.ts\n│   └── auth.ts\n├── prisma/\n│   └── schema.prisma\n└── next.config.js`,
  },
} as const satisfies Record<string, RepoData>;

export type RepoName = keyof typeof REPOS;
export const REPO_NAMES = Object.keys(REPOS) as RepoName[];
