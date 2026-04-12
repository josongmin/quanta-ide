export type AuditVerdict = "pass" | "fail" | "warn";

export interface AuditEntry {
  id: string;
  rule: string;
  category: "taint" | "auth" | "data" | "crypto" | "logging";
  verdict: AuditVerdict;
  detail: string;
  loc?: string;
  timestamp: string;
}

export const AUDIT_ENTRIES: AuditEntry[] = [
  { id: "a1", rule: "TAINT-001", category: "taint", verdict: "fail", detail: "Unsanitized user input reaches DB write", loc: "webhook.ts:31", timestamp: "2026-04-13T01:22:00Z" },
  { id: "a2", rule: "AUTH-003", category: "auth", verdict: "pass", detail: "All endpoints require authentication middleware", timestamp: "2026-04-13T01:22:01Z" },
  { id: "a3", rule: "DATA-007", category: "data", verdict: "fail", detail: "PII field 'email' logged without masking", loc: "audit.ts:12", timestamp: "2026-04-13T01:22:02Z" },
  { id: "a4", rule: "CRYPTO-002", category: "crypto", verdict: "pass", detail: "Webhook signatures use HMAC-SHA256", timestamp: "2026-04-13T01:22:03Z" },
  { id: "a5", rule: "LOG-001", category: "logging", verdict: "warn", detail: "Retry loop lacks structured error logging", loc: "orchestrator.py:318", timestamp: "2026-04-13T01:22:04Z" },
  { id: "a6", rule: "TAINT-004", category: "taint", verdict: "pass", detail: "Amount field sanitized before gateway call", timestamp: "2026-04-13T01:22:05Z" },
  { id: "a7", rule: "DATA-012", category: "data", verdict: "warn", detail: "Refund amount exposed in response body without redaction", loc: "fee.ts:42", timestamp: "2026-04-13T01:22:06Z" },
];
