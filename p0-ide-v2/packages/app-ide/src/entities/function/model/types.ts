import type { SymbolKind, Taint } from "@quanta/app-ide/entities/symbol";

export interface FunctionHeader {
  line: number;
  name: string;
  kind: SymbolKind;
  blast: number;
  blastCritical?: number;
  complexity: number;
  bigO?: string;
  tests: string;
  owner: string;
  taint?: Taint;
  dead?: boolean;
  riskScore: number;
  budgetPct?: number;
  /** God-method/class signal (>N fields, >M responsibilities). */
  god?: boolean;
  /** % of mutations caught by tests (0-100). Lower = weaker. */
  mutationScore?: number;
  /** True if function logic is complex enough to warrant property tests. */
  propertyGap?: boolean;
  /** True if associated tests have non-deterministic pass rate. */
  flaky?: boolean;
}
