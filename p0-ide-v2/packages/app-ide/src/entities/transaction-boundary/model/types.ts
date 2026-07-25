export type TxKind = "db-tx" | "saga" | "outbox" | "two-phase" | "best-effort";

export type TxStepKind =
  | "db-write"
  | "db-read"
  | "external-call"
  | "queue-publish"
  | "cache-write"
  | "in-memory";

export interface TxStep {
  id: string;
  kind: TxStepKind;
  symbol: string;
  file: string;
  line: number;
  /** Whether the step crosses out of the atomic boundary. */
  crossesBoundary: boolean;
  /** Compensation symbol for saga (if any). */
  compensation?: string;
  /** Notes to surface in UI. */
  note?: string;
}

export interface TxBoundary {
  id: string;
  label: string;
  kind: TxKind;
  /** Where the boundary is opened (e.g. `db.transaction(...)`). */
  startSymbol: string;
  startFile: string;
  startLine: number;
  /** Where the boundary commits / completes. */
  endSymbol: string;
  endFile: string;
  endLine: number;
  /** Steps inside the boundary, in execution order. */
  steps: TxStep[];
  /** Findings / risks specific to this boundary. */
  findings: { severity: "info" | "warn" | "danger"; message: string }[];
}

export interface TransactionMap {
  boundaries: TxBoundary[];
}
