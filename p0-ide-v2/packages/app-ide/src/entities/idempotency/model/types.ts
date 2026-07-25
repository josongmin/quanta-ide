export type IdemKeyStrategy =
  | "header-key"
  | "request-id"
  | "natural-key"
  | "dedupe-table"
  | "none";

export type IdemDuplicateBehavior =
  | "noop"           // detected and dropped
  | "double-effect"  // re-runs side effect → bug
  | "error"          // raises 409 / similar
  | "unknown";

export interface IdemRisk {
  id: string;
  /** Symbol that performs the side effect. */
  symbol: string;
  file: string;
  line: number;
  /** Human description of the side effect. */
  effect: string;
  /** Money/state impact tier. */
  impact: "low" | "medium" | "high" | "irreversible";
  keyStrategy: IdemKeyStrategy;
  duplicateBehavior: IdemDuplicateBehavior;
  /** 0..100 — composite score; higher = more risk. */
  riskScore: number;
  /** Where the retry is initiated (client retry, queue, scheduler). */
  retryOrigin: string;
  /** Test coverage for double-fire scenarios. */
  hasDoubleFireTest: boolean;
  /** Concrete remediation hint. */
  hint: string;
}

export interface IdempotencyMap {
  risks: IdemRisk[];
}
