import type { IntentReport } from "../model/types";

/**
 * Showcase file: 8 intent claims spanning ADR / RFC / docstring /
 * test-name / type-contract sources. Demonstrates all four GapStatus
 * values (matches / drifted / violated / missing) and a four-point
 * drift timeline from 2025-09 → 2026-04.
 */
const orchestrator: IntentReport = {
  fileName: "orchestrator.py",
  alignmentScore: 58,
  claims: [
    {
      id: "c-adr-007-timeout",
      source: "adr",
      sourceRef: "ADR-007",
      text: "All requests must complete within 30s or fail with TimeoutError.",
      authoredAt: "2025-06-12",
    },
    {
      id: "c-rfc-02-strategy",
      source: "rfc",
      sourceRef: "RFC-02",
      text: "Dispatch goes through Strategy.select() — no handler is invoked directly.",
      authoredAt: "2025-07-04",
    },
    {
      id: "c-rfc-11-hotswap",
      source: "rfc",
      sourceRef: "RFC-11",
      text: "Strategies can be hot-swapped at runtime without restarting the orchestrator.",
      authoredAt: "2026-01-19",
    },
    {
      id: "c-doc-no-global",
      source: "docstring",
      sourceRef: "orchestrator.py:Orchestrator.__doc__",
      text: "Orchestrator holds no global state; every call is independent.",
      authoredAt: "2025-08-22",
    },
    {
      id: "c-doc-idempotent",
      source: "docstring",
      sourceRef: "orchestrator.py:Orchestrator.dispatch.__doc__",
      text: "dispatch() is idempotent for the same correlation_id.",
      authoredAt: "2025-09-30",
    },
    {
      id: "c-doc-cancel",
      source: "docstring",
      sourceRef: "orchestrator.py:Orchestrator.cancel.__doc__",
      text: "cancel() returns True iff the request was actually mid-flight.",
      authoredAt: "2025-11-02",
    },
    {
      id: "c-test-timeout",
      source: "test-name",
      sourceRef: "test_orchestrator.py:test_handles_timeout",
      text: "Aborts and raises TimeoutError when the underlying handler exceeds the budget.",
      authoredAt: "2025-06-15",
    },
    {
      id: "c-type-contract",
      source: "type-contract",
      sourceRef: "orchestrator.py:Orchestrator.dispatch:Result[T, OrchestratorError]",
      text: "dispatch returns Result[T, OrchestratorError] — no raw exceptions cross the boundary.",
      authoredAt: "2025-10-18",
    },
  ],
  gaps: [
    {
      claimId: "c-adr-007-timeout",
      status: "matches",
      evidence: {
        id: "e-timeout",
        line: 142,
        symbolPath: "orchestrator.dispatch",
        snippet: "with timeout(self.budget_s):\n    return await handler(req)",
      },
      rationale: "30s budget enforced via async timeout; raises TimeoutError consistently.",
      severity: "info",
    },
    {
      claimId: "c-rfc-02-strategy",
      status: "drifted",
      evidence: {
        id: "e-strategy",
        line: 88,
        symbolPath: "orchestrator.dispatch",
        snippet: "handler = self._handlers[req.kind]\nreturn await handler(req)",
      },
      rationale:
        "RFC-02 mandates Strategy.select(); current code looks up a handler in a dict and calls it directly. Functionally equivalent but bypasses the strategy registry's metrics hook.",
      introducedAt: "2025-12-04",
      introducedBy: "f7c91ab · @junlee",
      severity: "warn",
    },
    {
      claimId: "c-rfc-11-hotswap",
      status: "missing",
      evidence: null,
      rationale:
        "RFC-11 promises runtime hot-swap of strategies. No register_strategy / swap_strategy entry point exists in the module.",
      introducedAt: "2026-01-19",
      introducedBy: "(unimplemented since RFC merge)",
      severity: "warn",
    },
    {
      claimId: "c-doc-no-global",
      status: "violated",
      evidence: {
        id: "e-global-cache",
        line: 19,
        symbolPath: "orchestrator._RESULT_CACHE",
        snippet: "_RESULT_CACHE: dict[str, Any] = {}\n# populated by dispatch(); never reset",
      },
      rationale:
        "Module-level _RESULT_CACHE is mutated by every dispatch() call and shared across instances. Directly contradicts the docstring's 'no global state' guarantee.",
      introducedAt: "2025-10-08",
      introducedBy: "3a5e2cd · @minju",
      severity: "danger",
    },
    {
      claimId: "c-doc-idempotent",
      status: "drifted",
      evidence: {
        id: "e-idempotent",
        line: 156,
        symbolPath: "orchestrator.dispatch",
        snippet: "if cid in _RESULT_CACHE:\n    return _RESULT_CACHE[cid]",
      },
      rationale:
        "Idempotent on success only — failed calls aren't recorded, so a retry can produce a different outcome. Behavioral drift from docstring promise.",
      introducedAt: "2026-02-11",
      introducedBy: "9b1ff04 · @junlee",
      severity: "warn",
    },
    {
      claimId: "c-doc-cancel",
      status: "matches",
      evidence: {
        id: "e-cancel",
        line: 211,
        symbolPath: "orchestrator.cancel",
        snippet: "task = self._inflight.pop(cid, None)\nif task is None:\n    return False",
      },
      rationale: "cancel() returns False when the request is unknown; True only after task.cancel().",
      severity: "info",
    },
    {
      claimId: "c-test-timeout",
      status: "matches",
      evidence: {
        id: "e-test-timeout",
        line: 142,
        symbolPath: "orchestrator.dispatch",
        snippet: "with timeout(self.budget_s):  # covered by test_handles_timeout",
      },
      rationale: "Test asserts TimeoutError is raised; matches dispatch() behavior.",
      severity: "info",
    },
    {
      claimId: "c-type-contract",
      status: "matches",
      evidence: {
        id: "e-result",
        line: 78,
        symbolPath: "orchestrator.dispatch",
        snippet: "def dispatch(self, req: Request) -> Result[T, OrchestratorError]: ...",
      },
      rationale: "Signature matches contract; all internal exceptions are wrapped into Result.err().",
      severity: "info",
    },
  ],
  driftTimeline: [
    { date: "2025-10-08", status: "violated", claimId: "c-doc-no-global" },
    { date: "2025-12-04", status: "drifted", claimId: "c-rfc-02-strategy" },
    { date: "2026-01-19", status: "missing", claimId: "c-rfc-11-hotswap" },
    { date: "2026-02-11", status: "drifted", claimId: "c-doc-idempotent" },
  ],
};

const routingPolicy: IntentReport = {
  fileName: "routing_policy.py",
  alignmentScore: 88,
  claims: [
    {
      id: "rp-adr-014",
      source: "adr",
      sourceRef: "ADR-014",
      text: "Routing decisions are deterministic for a given (tenant, route_key) pair.",
      authoredAt: "2025-08-04",
    },
    {
      id: "rp-doc-fallback",
      source: "docstring",
      sourceRef: "routing_policy.py:RoutingPolicy.resolve.__doc__",
      text: "Falls back to the default pool when no specific rule matches.",
      authoredAt: "2025-08-04",
    },
    {
      id: "rp-test-priority",
      source: "test-name",
      sourceRef: "test_routing_policy.py:test_priority_overrides_default",
      text: "Higher-priority rules supersede the default pool even when both match.",
      authoredAt: "2025-09-12",
    },
    {
      id: "rp-type-pool",
      source: "type-contract",
      sourceRef: "routing_policy.py:RoutingPolicy.resolve:Pool",
      text: "resolve() always returns a non-null Pool — never None.",
      authoredAt: "2025-09-12",
    },
  ],
  gaps: [
    {
      claimId: "rp-adr-014",
      status: "matches",
      evidence: {
        id: "rp-e-det",
        line: 64,
        symbolPath: "RoutingPolicy.resolve",
        snippet: "key = (tenant, route_key)\nreturn self._table[key]",
      },
      rationale: "Pure dict lookup — same input → same output.",
      severity: "info",
    },
    {
      claimId: "rp-doc-fallback",
      status: "matches",
      evidence: {
        id: "rp-e-fallback",
        line: 71,
        symbolPath: "RoutingPolicy.resolve",
        snippet: "return self._table.get(key, self._default_pool)",
      },
      rationale: "Default pool returned when no rule matches.",
      severity: "info",
    },
    {
      claimId: "rp-test-priority",
      status: "drifted",
      evidence: {
        id: "rp-e-priority",
        line: 58,
        symbolPath: "RoutingPolicy.resolve",
        snippet: "rules = sorted(self._rules, key=lambda r: r.priority)",
      },
      rationale:
        "Sort is ascending; test name implies higher priority wins. Currently last-priority-wins by accident — passes the test but the comparator semantics are inverted.",
      introducedAt: "2025-11-22",
      introducedBy: "2c81fa9 · @hana",
      severity: "warn",
    },
    {
      claimId: "rp-type-pool",
      status: "matches",
      evidence: {
        id: "rp-e-pool",
        line: 52,
        symbolPath: "RoutingPolicy.resolve",
        snippet: "def resolve(self, tenant: str, route_key: str) -> Pool: ...",
      },
      rationale: "Signature matches; no None branch in body.",
      severity: "info",
    },
  ],
  driftTimeline: [
    { date: "2025-11-22", status: "drifted", claimId: "rp-test-priority" },
  ],
};

const security: IntentReport = {
  fileName: "security.py",
  alignmentScore: 42,
  claims: [
    {
      id: "sec-adr-021-audit",
      source: "adr",
      sourceRef: "ADR-021",
      text: "Every authentication failure is recorded in the audit log within 100ms.",
      authoredAt: "2025-05-14",
    },
    {
      id: "sec-rfc-08-ratelimit",
      source: "rfc",
      sourceRef: "RFC-08",
      text: "Login endpoint enforces 5 attempts / 60s per source IP.",
      authoredAt: "2025-07-18",
    },
    {
      id: "sec-doc-noplain",
      source: "docstring",
      sourceRef: "security.py:hash_password.__doc__",
      text: "Plaintext passwords never leave this function.",
      authoredAt: "2025-08-01",
    },
    {
      id: "sec-test-mfa",
      source: "test-name",
      sourceRef: "test_security.py:test_mfa_required_for_admin",
      text: "Admin endpoints require MFA verification before any privileged action.",
      authoredAt: "2025-10-09",
    },
    {
      id: "sec-type-token",
      source: "type-contract",
      sourceRef: "security.py:issue_token:SignedToken",
      text: "issue_token() always returns a SignedToken — unsigned tokens are not constructible.",
      authoredAt: "2025-09-06",
    },
  ],
  gaps: [
    {
      claimId: "sec-adr-021-audit",
      status: "violated",
      evidence: {
        id: "sec-e-audit",
        line: 132,
        symbolPath: "security.authenticate",
        snippet: "except AuthError:\n    return None  # TODO: emit audit event",
      },
      rationale:
        "Auth failures are silently swallowed. ADR-021 requires an audit-log entry per failure. Compliance-blocking gap.",
      introducedAt: "2025-09-30",
      introducedBy: "8d4e6b1 · @junlee",
      severity: "danger",
    },
    {
      claimId: "sec-rfc-08-ratelimit",
      status: "missing",
      evidence: null,
      rationale:
        "No rate-limiter attached to the login endpoint. RFC-08 has been merged for 9 months without an implementation.",
      introducedAt: "2025-07-18",
      introducedBy: "(unimplemented since RFC merge)",
      severity: "danger",
    },
    {
      claimId: "sec-doc-noplain",
      status: "violated",
      evidence: {
        id: "sec-e-plain",
        line: 47,
        symbolPath: "security.hash_password",
        snippet: "logger.debug(f\"hashing pw={pw}\")  # leaks plaintext at DEBUG",
      },
      rationale:
        "Debug logger emits plaintext password. Direct contradiction of the docstring. Triggers DLP scanner alerts.",
      introducedAt: "2026-03-04",
      introducedBy: "0e2a417 · @minju",
      severity: "danger",
    },
    {
      claimId: "sec-test-mfa",
      status: "matches",
      evidence: {
        id: "sec-e-mfa",
        line: 188,
        symbolPath: "security.require_admin",
        snippet: "if not session.mfa_verified:\n    raise MFARequired()",
      },
      rationale: "Decorator enforces MFA on every admin route; matches the test expectation.",
      severity: "info",
    },
    {
      claimId: "sec-type-token",
      status: "matches",
      evidence: {
        id: "sec-e-token",
        line: 91,
        symbolPath: "security.issue_token",
        snippet: "def issue_token(...) -> SignedToken: ...",
      },
      rationale: "SignedToken constructor is private; only this function can build one.",
      severity: "info",
    },
  ],
  driftTimeline: [
    { date: "2025-09-30", status: "violated", claimId: "sec-adr-021-audit" },
    { date: "2026-03-04", status: "violated", claimId: "sec-doc-noplain" },
  ],
};

export const INTENT_REPORTS: Record<string, IntentReport> = {
  "orchestrator.py": orchestrator,
  "routing_policy.py": routingPolicy,
  "security.py": security,
};

export function getIntentReport(fileName: string): IntentReport | null {
  return INTENT_REPORTS[fileName] ?? null;
}
