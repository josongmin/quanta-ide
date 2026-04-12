-- =============================================================================
-- p0 analysis database schema
-- Source of truth for all static analysis results.
-- Populated by analysis engine, consumed by IDE + CLI.
-- =============================================================================

PRAGMA journal_mode = WAL;
PRAGMA foreign_keys = ON;

-- ── Files ─────────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS files (
  file_id    INTEGER PRIMARY KEY,
  path       TEXT NOT NULL UNIQUE,
  language   TEXT NOT NULL DEFAULT 'python',
  lines      INTEGER NOT NULL DEFAULT 0,
  last_analyzed TEXT,  -- ISO 8601
  checksum   TEXT       -- SHA-256 of file content at analysis time
);

-- ── Symbols ───────────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS symbols (
  symbol_id  INTEGER PRIMARY KEY,
  file_id    INTEGER NOT NULL REFERENCES files(file_id),
  name       TEXT NOT NULL,
  kind       TEXT NOT NULL,  -- 'function' | 'class' | 'method' | 'type' | 'const'
  line_start INTEGER NOT NULL,
  line_end   INTEGER,
  complexity REAL,
  is_dead    INTEGER NOT NULL DEFAULT 0,  -- 1 = dead code
  dead_reason TEXT,
  last_called TEXT,  -- ISO 8601 or NULL
  UNIQUE(file_id, name, line_start)
);

-- ── Risk per line ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS line_risk (
  file_id    INTEGER NOT NULL REFERENCES files(file_id),
  line_no    INTEGER NOT NULL,
  risk       INTEGER NOT NULL CHECK(risk BETWEEN 1 AND 4),
  PRIMARY KEY(file_id, line_no)
);

-- ── Taint flows ───────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS taint_flows (
  flow_id    INTEGER PRIMARY KEY,
  source_file_id INTEGER NOT NULL REFERENCES files(file_id),
  source_line    INTEGER NOT NULL,
  source_symbol  TEXT NOT NULL,
  sink_file_id   INTEGER NOT NULL REFERENCES files(file_id),
  sink_line      INTEGER NOT NULL,
  sink_symbol    TEXT NOT NULL,
  severity       TEXT NOT NULL DEFAULT 'high',  -- 'critical' | 'high' | 'medium' | 'low'
  sanitized      INTEGER NOT NULL DEFAULT 0
);

-- ── Blast radius (call graph edges) ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS call_edges (
  edge_id    INTEGER PRIMARY KEY,
  caller_file_id  INTEGER NOT NULL REFERENCES files(file_id),
  caller_symbol   TEXT NOT NULL,
  callee_file_id  INTEGER NOT NULL REFERENCES files(file_id),
  callee_symbol   TEXT NOT NULL,
  is_hot_path     INTEGER NOT NULL DEFAULT 0,
  coupling        REAL DEFAULT 0  -- 0-1
);

-- ── Test coverage ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS coverage (
  file_id    INTEGER NOT NULL REFERENCES files(file_id),
  symbol_name TEXT NOT NULL,
  line_start INTEGER NOT NULL,
  covered    INTEGER NOT NULL DEFAULT 0,  -- 1 = has test
  test_file  TEXT,     -- e.g. "tests/test_orchestrator.py"
  test_name  TEXT,     -- e.g. "test_execute_basic"
  PRIMARY KEY(file_id, symbol_name)
);

-- ── Churn metrics ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS churn (
  file_id        INTEGER NOT NULL REFERENCES files(file_id),
  commits_30d    INTEGER NOT NULL DEFAULT 0,
  authors_30d    INTEGER NOT NULL DEFAULT 0,
  lines_changed  INTEGER NOT NULL DEFAULT 0,
  trend          TEXT NOT NULL DEFAULT 'stable',  -- 'rising' | 'stable' | 'falling'
  spark_7d       TEXT,  -- JSON array of 7 floats (0-1 normalized)
  PRIMARY KEY(file_id)
);

-- ── Compliance findings ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS compliance (
  finding_id INTEGER PRIMARY KEY,
  file_id    INTEGER REFERENCES files(file_id),
  line_no    INTEGER,
  rule_id    TEXT NOT NULL,        -- e.g. "TAINT-001"
  category   TEXT NOT NULL,        -- 'taint' | 'auth' | 'data' | 'crypto' | 'logging'
  verdict    TEXT NOT NULL,        -- 'pass' | 'fail' | 'warn'
  detail     TEXT NOT NULL,
  timestamp  TEXT NOT NULL         -- ISO 8601
);

-- ── Incidents (root cause traces) ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS incidents (
  incident_id TEXT PRIMARY KEY,
  title       TEXT NOT NULL,
  severity    TEXT NOT NULL,       -- 'P0' | 'P1' | 'P2'
  root_file_id INTEGER REFERENCES files(file_id),
  root_line   INTEGER,
  root_symbol TEXT,
  explanation TEXT,
  confidence  TEXT DEFAULT 'high'
);

CREATE TABLE IF NOT EXISTS incident_trace (
  trace_id    INTEGER PRIMARY KEY,
  incident_id TEXT NOT NULL REFERENCES incidents(incident_id),
  step_order  INTEGER NOT NULL,
  file_id     INTEGER NOT NULL REFERENCES files(file_id),
  line_no     INTEGER NOT NULL,
  symbol      TEXT NOT NULL,
  kind        TEXT NOT NULL,       -- 'entry' | 'propagation' | 'root'
  summary     TEXT
);

-- ── Cross-service edges ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS services (
  service_id TEXT PRIMARY KEY,
  name       TEXT NOT NULL,
  owner      TEXT,
  status     TEXT DEFAULT 'healthy'  -- 'healthy' | 'degraded' | 'down'
);

CREATE TABLE IF NOT EXISTS service_edges (
  from_service TEXT NOT NULL REFERENCES services(service_id),
  to_service   TEXT NOT NULL REFERENCES services(service_id),
  protocol     TEXT NOT NULL,         -- 'gRPC' | 'HTTP' | 'Kafka' | 'DB'
  impacted     INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY(from_service, to_service)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_symbols_file ON symbols(file_id);
CREATE INDEX IF NOT EXISTS idx_symbols_dead ON symbols(is_dead) WHERE is_dead = 1;
CREATE INDEX IF NOT EXISTS idx_taint_source ON taint_flows(source_file_id);
CREATE INDEX IF NOT EXISTS idx_taint_sink ON taint_flows(sink_file_id);
CREATE INDEX IF NOT EXISTS idx_call_caller ON call_edges(caller_file_id);
CREATE INDEX IF NOT EXISTS idx_call_callee ON call_edges(callee_file_id);
CREATE INDEX IF NOT EXISTS idx_coverage_file ON coverage(file_id);
CREATE INDEX IF NOT EXISTS idx_compliance_file ON compliance(file_id);
