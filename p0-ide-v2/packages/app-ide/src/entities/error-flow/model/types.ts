export type Fate =
  | "caught-handled"
  | "caught-fallback"
  | "caught-swallowed"
  | "rethrown"
  | "uncaught";

export interface ThrowSite {
  id: string;
  errorType: string;
  line: number;
  frame: string;
}

export interface CatchHandler {
  id: string;
  errorTypes: string[];
  line: number;
  frame: string;
  hasFallback: boolean;
  hasLog: boolean;
  rethrows: boolean;
}

export interface ErrorPath {
  id: string;
  throwId: string;
  hops: string[];
  fate: Fate;
  finalLine?: number;
  weight: number;
}

export interface ErrorFlow {
  throws: ThrowSite[];
  catches: CatchHandler[];
  paths: ErrorPath[];
  completeness: number;
  uncaughtCount: number;
  swallowedCount: number;
}
