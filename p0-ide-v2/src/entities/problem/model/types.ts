export type Severity = "error" | "warn" | "info";

export interface ProblemItem {
  id: string;
  severity: Severity;
  line: number;
  col: number;
  message: string;
  source: string;
}

export interface ProblemGroup {
  path: string;
  items: ProblemItem[];
}
