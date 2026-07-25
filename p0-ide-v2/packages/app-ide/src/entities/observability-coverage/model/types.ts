export type ObsSignalKind = "log" | "metric" | "trace" | "alert";

export type ObsSiteStatus = "covered" | "partial" | "blind";

export interface ObsSpan {
  /** Function or block this span describes. */
  symbol: string;
  file: string;
  /** First line of the function in source. */
  startLine: number;
  /** Last line of the function in source. */
  endLine: number;
  /** Whether this span sits on a critical request path (latency/availability impact). */
  critical: boolean;
  /** Per-signal coverage state (covered/partial/blind). */
  signals: Record<ObsSignalKind, ObsSiteStatus>;
  /** Errors thrown by this fn over last 24h. */
  errorsObserved: number;
  /** Number of times this fn was invoked over last 24h. */
  callsObserved: number;
  /** Symbol's owner — used for coverage-by-owner rollup. */
  owner: string;
}

export interface ObservabilityCoverage {
  spans: ObsSpan[];
}
