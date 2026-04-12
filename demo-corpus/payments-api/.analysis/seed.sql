-- =============================================================================
-- Seed data — pre-computed analysis results for the demo corpus.
-- Run: sqlite3 analysis.db < schema.sql && sqlite3 analysis.db < seed.sql
-- =============================================================================

-- ── Files ─────────────────────────────────────────────────────────────────────
INSERT INTO files (file_id, path, language, lines, last_analyzed) VALUES
  (1,  'codegraph_agent/orchestrator/orchestrator.py', 'python', 159, '2026-04-13T01:00:00Z'),
  (2,  'codegraph_agent/orchestrator/routing_policy.py', 'python', 89, '2026-04-13T01:00:00Z'),
  (3,  'codegraph_agent/tools/plan_orchestration/security.py', 'python', 87, '2026-04-13T01:00:00Z'),
  (4,  'infrastructure/audit_store.py', 'python', 46, '2026-04-13T01:00:00Z'),
  (5,  'infrastructure/fee.py', 'python', 77, '2026-04-13T01:00:00Z'),
  (6,  'infrastructure/webhook.py', 'python', 82, '2026-04-13T01:00:00Z'),
  (7,  'infrastructure/retry.py', 'python', 72, '2026-04-13T01:00:00Z'),
  (8,  'infrastructure/ledger.py', 'python', 78, '2026-04-13T01:00:00Z'),
  (9,  'infrastructure/billing.py', 'python', 55, '2026-04-13T01:00:00Z'),
  (10, 'domain/models.py', 'python', 42, '2026-04-13T01:00:00Z'),
  (11, 'shared/reasoning.py', 'python', 15, '2026-04-13T01:00:00Z');

-- ── Symbols ───────────────────────────────────────────────────────────────────
-- orchestrator.py
INSERT INTO symbols (file_id, name, kind, line_start, line_end, complexity, is_dead, dead_reason) VALUES
  (1, 'DeepReasoningOrchestrator', 'class', 46, 159, NULL, 0, NULL),
  (1, 'execute', 'method', 64, 95, 9.1, 0, NULL),
  (1, '_decide_reasoning_path', 'method', 98, 106, 4.2, 0, NULL),
  (1, '_select_strategy', 'method', 108, 117, 5.1, 0, NULL),
  (1, '_run_strategy', 'method', 119, 130, 2.0, 0, NULL),
  (1, '_run_beam_strategy', 'method', 132, 135, 1.0, 0, NULL),
  (1, '_run_o1_strategy', 'method', 137, 138, 1.0, 0, NULL),
  (1, '_run_debate_strategy', 'method', 140, 141, 1.0, 0, NULL),
  (1, '_run_alphacode_strategy', 'method', 143, 144, 1.0, 0, NULL),
  (1, '_legacy_inference_bridge', 'method', 147, 149, 1.0, 1, 'Zero call-graph references since v7→v8 migration'),
  (1, 'OldRetryPolicy', 'class', 153, 156, 1.0, 1, 'Replaced by RetryScheduler in PR #312'),
  (1, 'TEMP_FEATURE_FLAG', 'const', 159, 159, 0, 1, 'Permanently enabled, gate always passes'),
  (1, 'DeepReasoningRequest', 'class', 28, 33, NULL, 0, NULL),
  (1, 'DeepReasoningResponse', 'class', 37, 42, NULL, 0, NULL);

-- routing_policy.py
INSERT INTO symbols (file_id, name, kind, line_start, line_end, complexity, is_dead, dead_reason) VALUES
  (2, 'DeepReasoningRoutingPolicy', 'class', 26, 89, NULL, 0, NULL),
  (2, 'estimate_confidence', 'method', 34, 49, 3.0, 0, NULL),
  (2, 'route_request', 'method', 52, 68, 4.5, 0, NULL),
  (2, '_select_backend', 'method', 70, 78, 2.0, 0, NULL),
  (2, '_old_route_v1', 'method', 81, 83, 1.0, 1, 'V1 routing removed in PR #298'),
  (2, 'formatLegacyResponse', 'method', 86, 88, 1.0, 1, 'Deprecated /v1/route endpoint removed');

-- security.py
INSERT INTO symbols (file_id, name, kind, line_start, line_end, complexity, is_dead, dead_reason) VALUES
  (3, 'AnalyzeControlFlowTool', 'class', 35, 87, NULL, 0, NULL),
  (3, '_analyze_taint_path_control_flow', 'method', 42, 57, 6.3, 0, NULL),
  (3, '_build_cfg', 'method', 60, 62, 1.0, 0, NULL),
  (3, '_run_semgrep_analysis', 'method', 64, 75, 3.2, 0, NULL),
  (3, '_identify_security_guards', 'method', 79, 81, 1.0, 0, NULL),
  (3, 'DebugTaintFlow', 'class', 84, 87, 1.0, 1, 'Debug-only, no production import path');

-- audit_store.py
INSERT INTO symbols (file_id, name, kind, line_start, line_end, complexity, is_dead) VALUES
  (4, 'AuditEntry', 'class', 17, 32, NULL, 0),
  (4, 'validate_event', 'method', 28, 32, 1.5, 0),
  (4, 'store_request', 'function', 34, 46, 2.1, 0);

-- fee.py
INSERT INTO symbols (file_id, name, kind, line_start, line_end, complexity, is_dead) VALUES
  (5, 'calculateFee', 'function', 36, 48, 3.0, 0),
  (5, 'validateFeeRule', 'function', 51, 56, 2.5, 0),
  (5, 'applyDiscount', 'function', 59, 61, 1.0, 0),
  (5, 'FeeConfig', 'class', 64, 68, NULL, 0);

-- webhook.py
INSERT INTO symbols (file_id, name, kind, line_start, line_end, complexity, is_dead) VALUES
  (6, 'dispatchWebhook', 'function', 39, 58, 4.0, 0),
  (6, 'verifySignature', 'function', 61, 64, 2.0, 0),
  (6, 'retryDelivery', 'function', 67, 70, 1.5, 0);

-- retry.py
INSERT INTO symbols (file_id, name, kind, line_start, line_end, complexity, is_dead, dead_reason) VALUES
  (7, 'RetryScheduler', 'class', 24, 46, 3.5, 0, NULL),
  (7, 'backoff', 'function', 49, 51, 1.0, 0, NULL),
  (7, 'MAX_RETRIES', 'const', 14, 14, 0, 1, 'Replaced by config-driven retry_count');

-- ledger.py
INSERT INTO symbols (file_id, name, kind, line_start, line_end, complexity, is_dead) VALUES
  (8, 'LedgerService', 'class', 23, 62, NULL, 0),
  (8, 'postEntry', 'method', 32, 39, 2.0, 0),
  (8, 'reconcile', 'method', 41, 53, 4.0, 0),
  (8, 'rollbackEntry', 'method', 55, 58, 1.5, 0);

-- billing.py
INSERT INTO symbols (file_id, name, kind, line_start, line_end, complexity, is_dead) VALUES
  (9, 'BillingService', 'class', 24, 47, NULL, 0),
  (9, 'chargeCycle', 'method', 34, 47, 3.0, 0);

-- ── Line Risk ─────────────────────────────────────────────────────────────────
INSERT INTO line_risk (file_id, line_no, risk) VALUES
  -- orchestrator.py
  (1, 64, 4), (1, 71, 4), (1, 73, 4), (1, 80, 4), (1, 86, 4),
  (1, 98, 3), (1, 108, 3), (1, 132, 2),
  -- routing_policy.py
  (2, 52, 3), (2, 53, 3), (2, 70, 2),
  -- security.py
  (3, 42, 4), (3, 47, 4), (3, 64, 4), (3, 65, 4), (3, 68, 3), (3, 79, 2),
  -- audit_store.py
  (4, 34, 2), (4, 39, 1),
  -- fee.py
  (5, 36, 4), (5, 51, 3), (5, 59, 2),
  -- webhook.py
  (6, 39, 4), (6, 61, 4), (6, 67, 2);

-- ── Taint Flows ───────────────────────────────────────────────────────────────
INSERT INTO taint_flows (source_file_id, source_line, source_symbol, sink_file_id, sink_line, sink_symbol, severity, sanitized) VALUES
  (1, 28, 'request.strategy', 1, 86, 'experience_store.save', 'critical', 0),
  (1, 28, 'request.task', 1, 108, '_select_strategy', 'high', 0),
  (6, 39, 'payload.amount', 6, 50, 'json.dumps(payload)', 'high', 0),
  (3, 42, 'target', 3, 64, '_run_semgrep_analysis', 'critical', 0);

-- ── Call Edges (blast radius) ─────────────────────────────────────────────────
INSERT INTO call_edges (caller_file_id, caller_symbol, callee_file_id, callee_symbol, is_hot_path, coupling) VALUES
  -- orchestrator direct callers
  (5, 'calculateFee', 1, 'execute', 1, 0.92),
  (6, 'dispatchWebhook', 1, 'execute', 1, 0.88),
  (7, 'RetryScheduler', 1, 'execute', 0, 0.71),
  (8, 'postEntry', 1, 'execute', 0, 0.65),
  (4, 'store_request', 1, 'execute', 0, 0.40),
  -- transitive
  (9, 'chargeCycle', 5, 'calculateFee', 1, 0.62),
  (8, 'reconcile', 8, 'postEntry', 0, 0.55);

-- ── Coverage ──────────────────────────────────────────────────────────────────
-- orchestrator.py: 0/12 (all uncovered)
INSERT INTO coverage (file_id, symbol_name, line_start, covered) VALUES
  (1, 'execute', 64, 0),
  (1, '_decide_reasoning_path', 98, 0),
  (1, '_select_strategy', 108, 0),
  (1, '_run_strategy', 119, 0),
  (1, '_run_beam_strategy', 132, 0),
  (1, '_run_o1_strategy', 137, 0),
  (1, '_run_debate_strategy', 140, 0),
  (1, '_run_alphacode_strategy', 143, 0);

-- routing_policy.py: 1/9
INSERT INTO coverage (file_id, symbol_name, line_start, covered, test_file, test_name) VALUES
  (2, 'estimate_confidence', 34, 1, 'tests/test_routing_policy.py', 'test_estimate_confidence_simple'),
  (2, 'route_request', 52, 0, NULL, NULL),
  (2, '_select_backend', 70, 0, NULL, NULL);

-- security.py: 2/7
INSERT INTO coverage (file_id, symbol_name, line_start, covered, test_file, test_name) VALUES
  (3, '_build_cfg', 60, 1, 'tests/test_security.py', 'test_build_cfg'),
  (3, '_identify_security_guards', 79, 1, 'tests/test_security.py', 'test_identify_guards'),
  (3, '_analyze_taint_path_control_flow', 42, 0, NULL, NULL),
  (3, '_run_semgrep_analysis', 64, 0, NULL, NULL);

-- audit_store.py: 5/5 (full)
INSERT INTO coverage (file_id, symbol_name, line_start, covered, test_file, test_name) VALUES
  (4, 'store_request', 34, 1, 'tests/test_audit_store.py', 'test_store_request_basic'),
  (4, 'validate_event', 28, 1, 'tests/test_audit_store.py', 'test_validate_event_empty');

-- fee.py: 0 tests
INSERT INTO coverage (file_id, symbol_name, line_start, covered) VALUES
  (5, 'calculateFee', 36, 0),
  (5, 'validateFeeRule', 51, 0),
  (5, 'applyDiscount', 59, 0);

-- webhook.py: 0 tests
INSERT INTO coverage (file_id, symbol_name, line_start, covered) VALUES
  (6, 'dispatchWebhook', 39, 0),
  (6, 'verifySignature', 61, 0),
  (6, 'retryDelivery', 67, 0);

-- retry.py: 0 tests
INSERT INTO coverage (file_id, symbol_name, line_start, covered) VALUES
  (7, 'RetryScheduler.execute', 37, 0),
  (7, '_compute_delay', 51, 0),
  (7, 'backoff', 57, 0);

-- ledger.py: 0 tests
INSERT INTO coverage (file_id, symbol_name, line_start, covered) VALUES
  (8, 'postEntry', 35, 0),
  (8, 'reconcile', 45, 0),
  (8, 'rollbackEntry', 62, 0);

-- billing.py: 0 tests
INSERT INTO coverage (file_id, symbol_name, line_start, covered) VALUES
  (9, 'chargeCycle', 39, 0);

-- ── Additional line risk for infra files ──────────────────────────────────────
INSERT INTO line_risk (file_id, line_no, risk) VALUES
  (7, 37, 3), (7, 51, 2),  -- retry
  (8, 35, 3), (8, 45, 3), (8, 62, 2),  -- ledger
  (9, 39, 3);  -- billing

-- ── Additional call edges (full graph) ────────────────────────────────────────
INSERT INTO call_edges (caller_file_id, caller_symbol, callee_file_id, callee_symbol, is_hot_path, coupling) VALUES
  -- fee → webhook (fee triggers webhook on charge)
  (5, 'calculateFee', 6, 'dispatchWebhook', 0, 0.45),
  -- webhook → retry (webhook uses retry for delivery)
  (6, 'dispatchWebhook', 7, 'RetryScheduler', 0, 0.38),
  -- orchestrator → ledger (direct write)
  (1, 'execute', 8, 'postEntry', 1, 0.65),
  -- orchestrator → audit_store
  (1, 'execute', 4, 'store_request', 0, 0.40),
  -- security → orchestrator (ci gate blocks)
  (3, '_analyze_taint_path_control_flow', 1, 'execute', 0, 0.30);

-- ── Additional taint flows ────────────────────────────────────────────────────
INSERT INTO taint_flows (source_file_id, source_line, source_symbol, sink_file_id, sink_line, sink_symbol, severity, sanitized) VALUES
  -- fee: amount flows through without validation
  (5, 33, 'amount', 5, 43, 'fee_amount', 'high', 0),
  -- ledger: entry amount to DB
  (8, 35, 'entry.amount', 8, 38, 'self._entries.append', 'medium', 0);

-- ── Churn ─────────────────────────────────────────────────────────────────────
INSERT INTO churn (file_id, commits_30d, authors_30d, lines_changed, trend, spark_7d) VALUES
  (1, 28, 4, 1240, 'rising',  '[0.3,0.4,0.5,0.7,0.8,0.9,1.0]'),
  (2, 14, 2, 380,  'stable',  '[0.4,0.5,0.4,0.4,0.5,0.4,0.5]'),
  (3, 19, 3, 720,  'rising',  '[0.2,0.3,0.4,0.5,0.7,0.8,0.9]'),
  (4, 3,  1, 40,   'falling', '[0.3,0.2,0.1,0.1,0.1,0.0,0.0]'),
  (5, 22, 3, 890,  'rising',  '[0.2,0.3,0.5,0.6,0.8,0.7,0.9]'),
  (6, 18, 3, 640,  'stable',  '[0.5,0.6,0.5,0.5,0.6,0.5,0.6]'),
  (7, 15, 2, 410,  'stable',  '[0.4,0.4,0.3,0.5,0.4,0.5,0.4]'),
  (8, 12, 2, 320,  'falling', '[0.8,0.7,0.5,0.4,0.3,0.2,0.2]'),
  (9, 9,  2, 210,  'falling', '[0.6,0.5,0.4,0.3,0.3,0.2,0.1]');

-- ── Compliance ────────────────────────────────────────────────────────────────
INSERT INTO compliance (file_id, line_no, rule_id, category, verdict, detail, timestamp) VALUES
  (6, 39, 'TAINT-001', 'taint', 'fail', 'Unsanitized user input reaches HTTP POST body', '2026-04-13T01:22:00Z'),
  (NULL, NULL, 'AUTH-003', 'auth', 'pass', 'All endpoints require authentication middleware', '2026-04-13T01:22:01Z'),
  (4, 22, 'DATA-007', 'data', 'fail', 'PII field email logged without masking', '2026-04-13T01:22:02Z'),
  (NULL, NULL, 'CRYPTO-002', 'crypto', 'pass', 'Webhook signatures use HMAC-SHA256', '2026-04-13T01:22:03Z'),
  (1, 71, 'LOG-001', 'logging', 'warn', 'Retry loop lacks structured error logging', '2026-04-13T01:22:04Z'),
  (NULL, NULL, 'TAINT-004', 'taint', 'pass', 'Amount field sanitized before gateway call', '2026-04-13T01:22:05Z'),
  (5, 36, 'DATA-012', 'data', 'warn', 'Refund amount exposed in response body without redaction', '2026-04-13T01:22:06Z');

-- ── Incidents ─────────────────────────────────────────────────────────────────
INSERT INTO incidents (incident_id, title, severity, root_file_id, root_line, root_symbol, explanation, confidence) VALUES
  ('INC-2024-0312', 'Double refund via retry loop', 'P0', 1, 73, 'retryLoop',
   'Retry loop at L:73 re-invokes execute() without idempotency check. When upstream returns transient 503, loop fires 3 times, each creating a refund entry via experience_store.save().',
   'high');

INSERT INTO incident_trace (incident_id, step_order, file_id, line_no, symbol, kind, summary) VALUES
  ('INC-2024-0312', 1, 1, 64, 'execute', 'entry', 'HTTP POST /refund received → execute()'),
  ('INC-2024-0312', 2, 1, 71, 'retryLoop', 'propagation', 'Retry loop begins, attempt 1'),
  ('INC-2024-0312', 3, 1, 73, 'retryLoop', 'root', 'No idempotency key check — duplicate write'),
  ('INC-2024-0312', 4, 1, 86, 'experience_store.save', 'propagation', '3× refund entry created'),
  ('INC-2024-0312', 5, 8, 32, 'postEntry', 'propagation', '3 ledger entries posted');

-- ── Services ──────────────────────────────────────────────────────────────────
INSERT INTO services (service_id, name, owner, status) VALUES
  ('payments', 'payments-api', '@payments-team', 'healthy'),
  ('billing', 'billing-service', '@billing-team', 'healthy'),
  ('webhook', 'webhook-relay', '@infra-team', 'degraded'),
  ('ledger', 'ledger-service', '@finance-team', 'healthy'),
  ('notify', 'notification-svc', '@platform-team', 'healthy'),
  ('audit', 'audit-trail', '@compliance-team', 'healthy');

INSERT INTO service_edges (from_service, to_service, protocol, impacted) VALUES
  ('payments', 'billing', 'gRPC', 1),
  ('payments', 'webhook', 'HTTP', 1),
  ('payments', 'ledger', 'gRPC', 1),
  ('billing', 'notify', 'Kafka', 1),
  ('ledger', 'audit', 'Kafka', 0),
  ('webhook', 'notify', 'HTTP', 0);
