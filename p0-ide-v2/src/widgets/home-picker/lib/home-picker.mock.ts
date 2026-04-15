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
