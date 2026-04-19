/* ── Shared mock types & data for HomePicker sections ─────────── */

// ── Recent projects (existing) ──────────────────────────────────
export type RecentStatus = "clean" | "changes" | "review";

export type InsightTag =
  | { kind: "commits"; n: number }
  | { kind: "pr"; n: number }
  | { kind: "rebase" }
  | { kind: "cve" }
  | { kind: "release"; v: string }
  | { kind: "quiet" };

export interface Insight {
  additions: number;
  deletions: number;
  authors: string[];
  tags: InsightTag[];
}

export interface SparkDay {
  add: number;
  del: number;
}

export interface RecentProject {
  name: string;
  branch: string;
  changes: number;
  status: RecentStatus;
  time: string;
  spark: SparkDay[];
  insight: Insight;
}

export const recents: RecentProject[] = [
  {
    name: "payments-api", branch: "main", changes: 3, status: "changes", time: "1h ago",
    spark: [
      { add: 12, del: 4 }, { add: 0, del: 0 }, { add: 28, del: 9 }, { add: 18, del: 6 },
      { add: 0, del: 0 }, { add: 36, del: 14 }, { add: 9, del: 3 }, { add: 22, del: 8 },
      { add: 0, del: 0 }, { add: 31, del: 11 }, { add: 48, del: 18 }, { add: 20, del: 7 },
      { add: 11, del: 4 }, { add: 30, del: 10 },
    ],
    insight: {
      additions: 240, deletions: 87,
      authors: ["R", "D"],
      tags: [{ kind: "commits", n: 3 }],
    },
  },
  {
    name: "order-service", branch: "feat/checkout", changes: 0, status: "clean", time: "3h ago",
    spark: [
      { add: 18, del: 22 }, { add: 8, del: 14 }, { add: 0, del: 0 }, { add: 0, del: 0 },
      { add: 6, del: 9 }, { add: 0, del: 0 }, { add: 0, del: 0 }, { add: 0, del: 0 },
      { add: 0, del: 0 }, { add: 0, del: 0 }, { add: 0, del: 0 }, { add: 0, del: 0 },
      { add: 0, del: 0 }, { add: 0, del: 0 },
    ],
    insight: {
      additions: 0, deletions: 0,
      authors: [],
      tags: [{ kind: "quiet" }],
    },
  },
  {
    name: "ledger-core", branch: "main", changes: 12, status: "review", time: "yesterday",
    spark: [
      { add: 0, del: 0 }, { add: 14, del: 3 }, { add: 22, del: 5 }, { add: 0, del: 0 },
      { add: 48, del: 12 }, { add: 33, del: 9 }, { add: 20, del: 6 }, { add: 62, del: 18 },
      { add: 95, del: 28 }, { add: 74, del: 20 }, { add: 42, del: 11 }, { add: 110, del: 34 },
      { add: 82, del: 24 }, { add: 130, del: 40 },
    ],
    insight: {
      additions: 1240, deletions: 340,
      authors: ["M", "J", "R", "D"],
      tags: [{ kind: "commits", n: 14 }, { kind: "pr", n: 1 }, { kind: "rebase" }],
    },
  },
  {
    name: "auth-gateway", branch: "release/0.4", changes: 1, status: "changes", time: "2d ago",
    spark: [
      { add: 0, del: 0 }, { add: 0, del: 0 }, { add: 9, del: 2 }, { add: 0, del: 0 },
      { add: 16, del: 3 }, { add: 24, del: 5 }, { add: 40, del: 8 }, { add: 32, del: 6 },
      { add: 18, del: 4 }, { add: 10, del: 2 }, { add: 0, del: 0 }, { add: 0, del: 0 },
      { add: 8, del: 2 }, { add: 0, del: 0 },
    ],
    insight: {
      additions: 45, deletions: 8,
      authors: ["M"],
      tags: [{ kind: "commits", n: 1 }, { kind: "release", v: "v0.4" }],
    },
  },
  {
    name: "search-index", branch: "main", changes: 0, status: "clean", time: "5d ago",
    spark: [
      { add: 28, del: 10 }, { add: 20, del: 7 }, { add: 36, del: 12 }, { add: 10, del: 4 },
      { add: 26, del: 9 }, { add: 18, del: 6 }, { add: 0, del: 0 }, { add: 11, del: 4 },
      { add: 0, del: 0 }, { add: 0, del: 0 }, { add: 0, del: 0 }, { add: 0, del: 0 },
      { add: 0, del: 0 }, { add: 0, del: 0 },
    ],
    insight: {
      additions: 180, deletions: 60,
      authors: ["D", "K"],
      tags: [{ kind: "commits", n: 7 }, { kind: "cve" }],
    },
  },
];

// ── Attention Queue ─────────────────────────────────────────────
export type AttentionKind = "violation" | "review-request" | "ci-failure" | "security" | "mention";
export type AttentionUrgency = "high" | "medium" | "low";

export interface AttentionItem {
  id: string;
  kind: AttentionKind;
  title: string;
  repo: string;
  branch?: string;
  time: string;
  urgency: AttentionUrgency;
}

export const attentionItems: AttentionItem[] = [
  {
    id: "a1", kind: "violation", urgency: "high",
    title: "Circular dependency in PaymentProcessor → OrderValidator",
    repo: "payments-api", branch: "feat/refund-v2", time: "12m ago",
  },
  {
    id: "a2", kind: "review-request", urgency: "medium",
    title: "PR #247: Migrate session store to Redis",
    repo: "auth-gateway", time: "1h ago",
  },
  {
    id: "a3", kind: "ci-failure", urgency: "high",
    title: "E2E suite failing — timeout on checkout flow",
    repo: "order-service", branch: "main", time: "25m ago",
  },
  {
    id: "a4", kind: "security", urgency: "high",
    title: "CVE-2026-1832 in jsonwebtoken@8.5.1",
    repo: "auth-gateway", time: "3h ago",
  },
  {
    id: "a5", kind: "mention", urgency: "low",
    title: "@song mentioned you in PR #189 review",
    repo: "ledger-core", time: "4h ago",
  },
];

// ── Active Work ─────────────────────────────────────────────────
export type WorkStatus = "draft" | "open" | "reviewing" | "approved" | "changes-requested";

export interface ActiveWorkItem {
  id: string;
  title: string;
  number: number;
  repo: string;
  branch: string;
  status: WorkStatus;
  checks: { pass: number; fail: number; pending: number };
  violations: number;
  updatedAt: string;
}

export const activeWorkItems: ActiveWorkItem[] = [
  {
    id: "w1", title: "Add refund idempotency key", number: 312,
    repo: "payments-api", branch: "feat/refund-v2",
    status: "open", checks: { pass: 11, fail: 0, pending: 2 }, violations: 1, updatedAt: "20m ago",
  },
  {
    id: "w2", title: "Fix N+1 query in order listing", number: 298,
    repo: "order-service", branch: "fix/n-plus-one",
    status: "approved", checks: { pass: 14, fail: 0, pending: 0 }, violations: 0, updatedAt: "2h ago",
  },
  {
    id: "w3", title: "Tokenizer cache warming strategy", number: 156,
    repo: "search-index", branch: "perf/cache-warm",
    status: "draft", checks: { pass: 0, fail: 0, pending: 0 }, violations: 0, updatedAt: "1d ago",
  },
  {
    id: "w4", title: "Extract shared validation utils", number: 201,
    repo: "ledger-core", branch: "refactor/validations",
    status: "changes-requested", checks: { pass: 8, fail: 1, pending: 0 }, violations: 3, updatedAt: "5h ago",
  },
];

// ── Team Activity ───────────────────────────────────────────────
export type ActivityAction = "merged" | "opened" | "commented" | "deployed" | "pushed" | "resolved";

export interface TeamActivityItem {
  id: string;
  author: string;
  authorInitial: string;
  action: ActivityAction;
  target: string;
  repo: string;
  time: string;
}

export const teamActivityItems: TeamActivityItem[] = [
  { id: "f1", author: "Ryu", authorInitial: "R", action: "merged", target: "PR #245: Batch payment reconciliation", repo: "payments-api", time: "8m ago" },
  { id: "f2", author: "Mina", authorInitial: "M", action: "deployed", target: "v0.4.1 to production", repo: "auth-gateway", time: "34m ago" },
  { id: "f3", author: "Dan", authorInitial: "D", action: "opened", target: "PR #302: Add search synonyms", repo: "search-index", time: "1h ago" },
  { id: "f4", author: "Jun", authorInitial: "J", action: "commented", target: "PR #247: Redis session migration", repo: "auth-gateway", time: "2h ago" },
  { id: "f5", author: "Ryu", authorInitial: "R", action: "resolved", target: "3 architecture violations", repo: "ledger-core", time: "3h ago" },
  { id: "f6", author: "Dan", authorInitial: "D", action: "pushed", target: "5 commits to main", repo: "order-service", time: "5h ago" },
];

// ── Contextual Tips ─────────────────────────────────────────────
export interface Tip {
  id: string;
  title: string;
  description: string;
  shortcut?: string;
}

export const tips: Tip[] = [
  { id: "t1", title: "Blast Radius", description: "See the impact of any change before it ships. Hover any function to preview.", shortcut: "⌘ 3" },
  { id: "t2", title: "Taint Analysis", description: "Trace untrusted input from entry to sink across service boundaries.", shortcut: "⌘ 4" },
  { id: "t3", title: "Behavior Diff", description: "Compare runtime behavior between branches, not just text diff.", shortcut: "⌘ 5" },
  { id: "t4", title: "Agent Rules", description: "Define structural invariants. The engine enforces them on every commit." },
  { id: "t5", title: "Quick Inspector", description: "Pin a variable to see ownership, callers, and mutation history inline.", shortcut: "⌘ E" },
];
