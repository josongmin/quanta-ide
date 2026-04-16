import type { SecurityFlowFinding } from "./types";

// ═══════════════════════════════════════════════════════════════════════
//  Finding 1 — SQL Injection via unsanitised user input
// ═══════════════════════════════════════════════════════════════════════

const sqlInjection: SecurityFlowFinding = {
  id: "finding-sql-injection",
  title: "SQL Injection via req.body.userId",
  description:
    "User-controlled input from HTTP request body reaches a raw SQL query without parameterisation. " +
    "An attacker can manipulate the userId field to execute arbitrary SQL commands.",
  severity: 3,
  owaspCode: "A03",
  sourceFile: "src/routes/users.ts",
  sinkFile: "src/repositories/user-repo.ts",
  firstSeen: "2026-04-15",
  prDelta: true,
  fixGuidance:
    "Replace string concatenation in buildUserQuery with parameterised queries " +
    "(e.g. db.execute('SELECT * FROM users WHERE id = $1', [userId])). " +
    "Never interpolate user input into SQL strings directly.",
  paths: [
    // ── Path 1: direct injection, no sanitiser (NEW in this PR) ──────
    {
      id: "path-sqli-1",
      title: "req.body → buildQuery → db.execute (no sanitiser)",
      severity: 3,
      confidence: "high",
      owaspCode: "A03",
      sanitizerGaps: ["gap-sqli-1"],
      isNew: true,
      reachable: true,
      nodes: [
        {
          id: "src-sqli-1",
          kind: "source",
          label: "req.body.userId",
          file: "src/routes/users.ts",
          line: 42,
          col: 22,
          detail: "Unsanitised HTTP request body parameter enters the application",
          confidence: "high",
          dataType: "string",
          snippet: "const userId = req.body.userId;",
        },
        {
          id: "prop-sqli-1",
          kind: "propagate",
          label: "parseUserId(userId)",
          file: "src/services/user-service.ts",
          line: 18,
          col: 10,
          detail: "Type coercion only — no SQL-safe transformation applied. Taint propagates unchanged.",
          confidence: "high",
          dataType: "string",
          snippet: "const id = parseUserId(userId);",
        },
        {
          id: "gap-sqli-1",
          kind: "gap",
          label: "Missing parameterisation",
          file: "src/repositories/user-repo.ts",
          line: 28,
          detail:
            "Parameterised query conversion required before reaching DB layer. " +
            "No sanitiser exists on this path.",
          confidence: "high",
          expectedSanitizer: "db.parameterize() or prepared statement",
        },
        {
          id: "prop-sqli-2",
          kind: "propagate",
          label: "buildUserQuery(id)",
          file: "src/repositories/user-repo.ts",
          line: 31,
          col: 8,
          detail: "Query string constructed via string concatenation — tainted value embedded directly",
          confidence: "high",
          dataType: "string",
          snippet: "const sql = `SELECT * FROM users WHERE id = '${id}'`;",
        },
        {
          id: "sink-sqli-1",
          kind: "sink",
          label: "db.execute(sql)",
          file: "src/repositories/user-repo.ts",
          line: 37,
          col: 4,
          detail: "Direct SQL execution with tainted string — SQL injection possible",
          confidence: "high",
          dataType: "SQL query",
          snippet: "const result = await db.execute(sql);",
        },
      ],
      edges: [
        { id: "e-sqli-1a", from: "src-sqli-1",  to: "prop-sqli-1", dataLabel: "userId (string)", tainted: true },
        { id: "e-sqli-1b", from: "prop-sqli-1",  to: "gap-sqli-1",  dataLabel: "id (string)",     tainted: true },
        { id: "e-sqli-1c", from: "gap-sqli-1",   to: "prop-sqli-2", dataLabel: "id (string)",     tainted: true },
        { id: "e-sqli-1d", from: "prop-sqli-2",  to: "sink-sqli-1", dataLabel: "sql (string)",    tainted: true },
      ],
    },

    // ── Path 2: partial escape — weaker but still vulnerable ─────────
    {
      id: "path-sqli-2",
      title: "req.query.filter → escapeString → db.query (partial)",
      severity: 2,
      confidence: "medium",
      owaspCode: "A03",
      sanitizerGaps: [],
      isNew: false,
      reachable: true,
      nodes: [
        {
          id: "src-sqli-2",
          kind: "source",
          label: "req.query.filter",
          file: "src/routes/users.ts",
          line: 58,
          col: 24,
          detail: "URL query parameter — attacker-controlled",
          confidence: "high",
          dataType: "string",
          snippet: "const filter = req.query.filter;",
        },
        {
          id: "san-sqli-2",
          kind: "sanitize",
          label: "escapeString(filter)",
          file: "src/lib/sql-helpers.ts",
          line: 12,
          col: 10,
          detail: "Basic string escaping applied — prevents simple injection but may not cover all bypass vectors (e.g. unicode, nested encoding)",
          confidence: "medium",
          dataType: "string",
          snippet: "const safe = escapeString(filter);",
        },
        {
          id: "prop-sqli-2b",
          kind: "propagate",
          label: "formatFilter(safe)",
          file: "src/services/user-service.ts",
          line: 34,
          col: 8,
          detail: "Filter value formatted into WHERE clause — escaped but not parameterised",
          confidence: "medium",
          dataType: "string",
          snippet: "const clause = formatFilter(safe);",
        },
        {
          id: "sink-sqli-2",
          kind: "sink",
          label: "db.query(clause)",
          file: "src/repositories/user-repo.ts",
          line: 52,
          col: 4,
          detail: "SQL execution with escaped (not parameterised) input — reduced but non-zero risk",
          confidence: "medium",
          dataType: "SQL query",
          snippet: "return db.query(clause);",
        },
      ],
      edges: [
        { id: "e-sqli-2a", from: "src-sqli-2",   to: "san-sqli-2",  dataLabel: "filter (raw)",    tainted: true },
        { id: "e-sqli-2b", from: "san-sqli-2",   to: "prop-sqli-2b", dataLabel: "safe (escaped)", tainted: false },
        { id: "e-sqli-2c", from: "prop-sqli-2b", to: "sink-sqli-2",  dataLabel: "clause (SQL)",   tainted: false },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
//  Finding 2 — PII leaking into application logs
// ═══════════════════════════════════════════════════════════════════════

const piiLogging: SecurityFlowFinding = {
  id: "finding-pii-logging",
  title: "Sensitive PII in application logs",
  description:
    "User password and payment card data reach the application logger without being stripped. " +
    "Log aggregation systems (Datadog, Splunk) would persist this data in plain text.",
  severity: 2,
  owaspCode: "A09",
  sourceFile: "src/auth/login-handler.ts",
  sinkFile: "src/middleware/audit-log.ts",
  firstSeen: "2026-03-20",
  prDelta: false,
  fixGuidance:
    "Implement a log sanitiser middleware that strips sensitive fields (password, cardNumber, ssn) " +
    "before they reach the logger. Use a redaction utility like `redactSensitive(obj)` at the boundary.",
  paths: [
    {
      id: "path-pii-1",
      title: "user.password → buildAuthResponse → logger.info",
      severity: 2,
      confidence: "high",
      owaspCode: "A09",
      sanitizerGaps: ["gap-pii-1"],
      isNew: false,
      reachable: true,
      nodes: [
        {
          id: "src-pii-1",
          kind: "source",
          label: "user.password",
          file: "src/auth/login-handler.ts",
          line: 23,
          col: 14,
          detail: "Sensitive credential field accessed from user model",
          confidence: "high",
          dataType: "string (credential)",
          snippet: "const user = await db.findUser(email);",
        },
        {
          id: "prop-pii-1",
          kind: "propagate",
          label: "buildAuthResponse(user)",
          file: "src/auth/auth-service.ts",
          line: 45,
          col: 10,
          detail: "Response object includes full user model with password field",
          confidence: "high",
          dataType: "AuthResponse",
          snippet: "const resp = buildAuthResponse(user);",
        },
        {
          id: "gap-pii-1",
          kind: "gap",
          label: "Missing field redaction",
          file: "src/middleware/audit-log.ts",
          line: 60,
          detail: "Sensitive fields should be stripped before passing to logger",
          confidence: "high",
          expectedSanitizer: "redactSensitive(obj) or field allowlist",
        },
        {
          id: "sink-pii-1",
          kind: "sink",
          label: "logger.info('auth', { user })",
          file: "src/middleware/audit-log.ts",
          line: 67,
          col: 4,
          detail: "Full object logged including password — persisted in log aggregation",
          confidence: "high",
          dataType: "log entry",
          snippet: "logger.info('auth attempt', { user: resp });",
        },
      ],
      edges: [
        { id: "e-pii-1a", from: "src-pii-1",  to: "prop-pii-1", dataLabel: "user (full model)", tainted: true },
        { id: "e-pii-1b", from: "prop-pii-1", to: "gap-pii-1",  dataLabel: "resp (with password)", tainted: true },
        { id: "e-pii-1c", from: "gap-pii-1",  to: "sink-pii-1", dataLabel: "resp (unredacted)", tainted: true },
      ],
    },
    {
      id: "path-pii-2",
      title: "payment.cardNumber → processPayment → logger.error",
      severity: 3,
      confidence: "high",
      owaspCode: "A09",
      sanitizerGaps: ["gap-pii-2"],
      isNew: true,
      reachable: true,
      nodes: [
        {
          id: "src-pii-2",
          kind: "source",
          label: "payment.cardNumber",
          file: "src/payments/checkout.ts",
          line: 31,
          col: 18,
          detail: "PCI-regulated card number field from payment request",
          confidence: "high",
          dataType: "string (PAN)",
          snippet: "const { cardNumber } = payment;",
        },
        {
          id: "prop-pii-2",
          kind: "propagate",
          label: "processPayment(payment)",
          file: "src/payments/payment-service.ts",
          line: 55,
          col: 10,
          detail: "Payment object passed in full — card number not masked",
          confidence: "high",
          dataType: "PaymentRequest",
          snippet: "const result = processPayment(payment);",
        },
        {
          id: "branch-pii-2",
          kind: "branch",
          label: "catch (error)",
          file: "src/payments/payment-service.ts",
          line: 62,
          col: 4,
          detail: "Error handler catches payment failure — logs full context for debugging",
          confidence: "high",
          snippet: "} catch (error) {",
        },
        {
          id: "gap-pii-2",
          kind: "gap",
          label: "Missing PAN masking",
          file: "src/payments/payment-service.ts",
          line: 63,
          detail: "Card number must be masked (e.g. ****1234) before reaching any logger",
          confidence: "high",
          expectedSanitizer: "maskPAN(cardNumber) or PCI-compliant redaction",
        },
        {
          id: "sink-pii-2",
          kind: "sink",
          label: "logger.error('payment failed', ctx)",
          file: "src/payments/payment-service.ts",
          line: 64,
          col: 6,
          detail: "Error log includes full payment context with unmasked card number — PCI violation",
          confidence: "high",
          dataType: "log entry",
          snippet: "logger.error('payment failed', { payment, error });",
        },
      ],
      edges: [
        { id: "e-pii-2a", from: "src-pii-2",    to: "prop-pii-2",   dataLabel: "cardNumber (PAN)", tainted: true },
        { id: "e-pii-2b", from: "prop-pii-2",   to: "branch-pii-2", dataLabel: "payment (full)",   tainted: true },
        { id: "e-pii-2c", from: "branch-pii-2", to: "gap-pii-2",    dataLabel: "ctx (with PAN)",   tainted: true },
        { id: "e-pii-2d", from: "gap-pii-2",    to: "sink-pii-2",   dataLabel: "ctx (unmasked)",   tainted: true },
      ],
    },
  ],
};

// ═══════════════════════════════════════════════════════════════════════
//  Finding 3 — SSRF via user-controlled webhook URL
// ═══════════════════════════════════════════════════════════════════════

const ssrf: SecurityFlowFinding = {
  id: "finding-ssrf",
  title: "SSRF via user-controlled webhook URL",
  description:
    "User-supplied webhook URL is fetched server-side with insufficient validation. " +
    "An attacker can target internal services (169.254.169.254, localhost, private IPs) " +
    "to exfiltrate cloud metadata or probe internal networks.",
  severity: 3,
  owaspCode: "A10",
  sourceFile: "src/api/webhooks.ts",
  sinkFile: "src/services/webhook-service.ts",
  firstSeen: "2026-04-16",
  prDelta: true,
  fixGuidance:
    "1. Validate the URL against a strict allowlist of hostnames. " +
    "2. Resolve DNS and reject private/loopback IPs before fetching. " +
    "3. Use a dedicated egress proxy that blocks internal network access.",
  paths: [
    {
      id: "path-ssrf-1",
      title: "req.body.webhookUrl → validateUrl → fetch (bypass possible)",
      severity: 3,
      confidence: "high",
      owaspCode: "A10",
      sanitizerGaps: ["gap-ssrf-1"],
      isNew: true,
      reachable: true,
      nodes: [
        {
          id: "src-ssrf-1",
          kind: "source",
          label: "req.body.webhookUrl",
          file: "src/api/webhooks.ts",
          line: 12,
          col: 22,
          detail: "User-supplied URL from webhook registration endpoint",
          confidence: "high",
          dataType: "string (URL)",
          snippet: "const { webhookUrl } = req.body;",
        },
        {
          id: "guard-ssrf-1",
          kind: "guard",
          label: "validateWebhookUrl(url)",
          file: "src/services/webhook-service.ts",
          line: 28,
          col: 6,
          detail:
            "Hostname allowlist check — but only validates initial URL, does not follow redirects. " +
            "Attacker can use open redirect or DNS rebinding to bypass.",
          confidence: "medium",
          dataType: "string (URL)",
          snippet: "if (!validateWebhookUrl(url)) throw new Error('invalid');",
        },
        {
          id: "gap-ssrf-1",
          kind: "gap",
          label: "Missing redirect & DNS check",
          file: "src/services/webhook-service.ts",
          line: 35,
          detail:
            "Need DNS resolution check + redirect-following disabled or validated per-hop. " +
            "Current validation only checks the initial hostname.",
          confidence: "high",
          expectedSanitizer: "resolveAndValidateIP(url) + { redirect: 'error' }",
        },
        {
          id: "sink-ssrf-1",
          kind: "sink",
          label: "fetch(webhookUrl)",
          file: "src/services/webhook-service.ts",
          line: 44,
          col: 18,
          detail:
            "Server-side HTTP fetch to user-controlled URL — SSRF if validation is bypassed. " +
            "Response body may contain internal service data.",
          confidence: "high",
          dataType: "HTTP request",
          snippet: "const res = await fetch(webhookUrl, { method: 'POST', body });",
        },
      ],
      edges: [
        { id: "e-ssrf-1a", from: "src-ssrf-1",   to: "guard-ssrf-1", dataLabel: "webhookUrl",              tainted: true },
        { id: "e-ssrf-1b", from: "guard-ssrf-1",  to: "gap-ssrf-1",  dataLabel: "url (partially checked)", tainted: true },
        { id: "e-ssrf-1c", from: "gap-ssrf-1",    to: "sink-ssrf-1", dataLabel: "url (bypassable)",        tainted: true },
      ],
    },
    {
      id: "path-ssrf-2",
      title: "config.integrationUrl → httpClient.get (trusted)",
      severity: 1,
      confidence: "low",
      owaspCode: "A10",
      sanitizerGaps: [],
      isNew: false,
      reachable: false,
      nodes: [
        {
          id: "src-ssrf-2",
          kind: "source",
          label: "config.integrationUrl",
          file: "src/config/integrations.ts",
          line: 8,
          col: 10,
          detail: "Server-side configuration — not user-controllable in normal operation",
          confidence: "low",
          dataType: "string (URL)",
          snippet: "const integrationUrl = config.integrationUrl;",
        },
        {
          id: "san-ssrf-2",
          kind: "sanitize",
          label: "allowlistCheck(url)",
          file: "src/lib/http-client.ts",
          line: 15,
          col: 6,
          detail: "Full allowlist + DNS resolution + private IP rejection. Secure.",
          confidence: "high",
          dataType: "string (URL)",
          snippet: "assertAllowedUrl(url);",
        },
        {
          id: "sink-ssrf-2",
          kind: "sink",
          label: "httpClient.get(url)",
          file: "src/lib/http-client.ts",
          line: 22,
          col: 10,
          detail: "HTTP fetch via hardened client — sanitised path, low risk",
          confidence: "low",
          dataType: "HTTP request",
          snippet: "return httpClient.get(url);",
        },
      ],
      edges: [
        { id: "e-ssrf-2a", from: "src-ssrf-2", to: "san-ssrf-2",  dataLabel: "integrationUrl",    tainted: true },
        { id: "e-ssrf-2b", from: "san-ssrf-2", to: "sink-ssrf-2", dataLabel: "url (allow-listed)", tainted: false },
      ],
    },
  ],
};

// ── Exports ─────────────────────────────────────────────────────────

export const MOCK_FINDINGS: SecurityFlowFinding[] = [
  sqlInjection,
  piiLogging,
  ssrf,
];
