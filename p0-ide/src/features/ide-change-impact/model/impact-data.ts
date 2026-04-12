import type { ChangeImpactData } from "./useChangeImpact";

/**
 * Sample impact data matching the screenshot scenario:
 * refreshSession() changed → 14 files, 32 functions, Risk 78
 */
export const SAMPLE_IMPACT: ChangeImpactData = {
  originLine: 19,
  originFn: "refreshSession",
  riskScore: 78,
  files: 14,
  functions: 32,
  apis: 3,
  tests: 11,
  confidence: 0.91,
  summary:
    "Changing this line affects session validation, request auth middleware, and 3 API response paths.",
  propagation: [
    { order: 1, label: "session refresh token validation changes" },
    { order: 2, label: "middleware/auth.ts reads new claim path" },
    { order: 3, label: "api/me.ts response semantics shift" },
    { order: 4, label: "legacy session_store fallback becomes stale" },
  ],
  topFiles: [
    { name: "auth/session.ts", severity: "critical", reason: "token refresh path" },
    { name: "auth/jwt.ts", severity: "high", reason: "signature + claims" },
    { name: "api/me.ts", severity: "high", reason: "session read" },
    { name: "middleware/auth.ts", severity: "medium", reason: "claim validation" },
    { name: "db/session_store.ts", severity: "low", reason: "legacy fallback" },
  ],
};
