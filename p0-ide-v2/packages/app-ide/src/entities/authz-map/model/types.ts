export type GuardKind = "auth" | "role" | "permission" | "tenant" | "rate-limit";

export interface AuthzGuard {
  kind: GuardKind;
  /** Symbol or middleware name. */
  symbol: string;
  file: string;
  line: number;
  /** Human predicate, e.g. `role >= admin` or `scope:billing.write`. */
  predicate: string;
}

export interface AuthzGap {
  /** Why we believe this is missing — anchors the false-positive judgement. */
  reason: string;
  expected: GuardKind;
  /** CWE / OWASP mapping if applicable. */
  cwe?: string;
}

export interface AuthzRoute {
  id: string;
  method: string;
  path: string;
  handler: string;
  handlerFile: string;
  handlerLine: number;
  /** Resource being accessed (REST resource or RPC). */
  resource: string;
  /** Action category — reads vs writes get different rule sets. */
  action: "read" | "write" | "admin" | "destructive";
  /** Guards that wrap this route. */
  guards: AuthzGuard[];
  /** Missing-guard findings — empty array = green. */
  gaps: AuthzGap[];
}

export interface AuthzMap {
  /** All routes touching this file (handler or guard). */
  routes: AuthzRoute[];
}
