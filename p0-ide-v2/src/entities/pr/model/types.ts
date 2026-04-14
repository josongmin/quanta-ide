export type Mode = "diff" | "insights" | "graph" | "tests";
export type Severity = "blocker" | "high" | "med" | "low";
export type HunkLineKind = "ctx" | "add" | "del" | "meta";
export type FileStatus = "M" | "A" | "D" | "R";

export interface HunkLine {
  kind: HunkLineKind;
  ln?: number;
  rn?: number;
  text: string;
  inlineFinding?: number;
  inlineReview?: number;
}

export interface FileDiff {
  path: string;
  status: FileStatus;
  added: number;
  removed: number;
  risk: number;
  reviewed: boolean;
  findings: number;
  comments: number;
  hunks: HunkLine[][];
}

export interface Finding {
  id: number;
  sev: Severity;
  rule: string;
  title: string;
  path: string;
  line: number;
  detail: string;
  autofix: boolean;
  applied?: boolean;
}

export interface ReviewComment {
  id: number;
  author: string;
  avatar: string;
  when: string;
  path: string;
  line: number;
  body: string;
  suggestion?: string;
  applied?: boolean;
  resolved?: boolean;
}

export interface Pr {
  id: string;
  number: number;
  title: string;
  author: string;
  authorAvatar: string;
  branch: string;
  base: string;
  state: "open" | "draft" | "review" | "merged";
  ci: "pass" | "fail" | "run";
  risk: number;
  added: number;
  removed: number;
  files: number;
  when: string;
  reviewers: { name: string; avatar: string; status: "approved" | "requested" | "pending" }[];
  labels: string[];
  findingsCount: number;
  autofixCount: number;
}
