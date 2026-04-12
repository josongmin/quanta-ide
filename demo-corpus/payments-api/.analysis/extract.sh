#!/usr/bin/env bash
# Extract analysis DB → JSON files for IDE consumption.
# Called by Vite plugin at dev/build time. No dependencies needed (uses system sqlite3).
set -euo pipefail

DB="$(dirname "$0")/analysis.db"
OUT="$(dirname "$0")/generated"
mkdir -p "$OUT"

if [ ! -f "$DB" ]; then
  echo "⚠ analysis.db not found — run: sqlite3 analysis.db < schema.sql && sqlite3 analysis.db < seed.sql"
  exit 1
fi

# Helper: query → JSON array
q() { sqlite3 -json "$DB" "$1"; }

# ── files.json
q "SELECT file_id, path, language, lines FROM files ORDER BY file_id" > "$OUT/files.json"

# ── symbols.json
q "SELECT s.symbol_id, f.path as file, s.name, s.kind, s.line_start, s.line_end, s.complexity, s.is_dead, s.dead_reason, s.last_called
   FROM symbols s JOIN files f ON s.file_id = f.file_id
   ORDER BY f.path, s.line_start" > "$OUT/symbols.json"

# ── line_risk.json
q "SELECT f.path as file, lr.line_no, lr.risk
   FROM line_risk lr JOIN files f ON lr.file_id = f.file_id
   ORDER BY f.path, lr.line_no" > "$OUT/line-risk.json"

# ── taint_flows.json
q "SELECT tf.flow_id,
          sf.path as source_file, tf.source_line, tf.source_symbol,
          df.path as sink_file, tf.sink_line, tf.sink_symbol,
          tf.severity, tf.sanitized
   FROM taint_flows tf
   JOIN files sf ON tf.source_file_id = sf.file_id
   JOIN files df ON tf.sink_file_id = df.file_id" > "$OUT/taint-flows.json"

# ── call_edges.json (blast radius)
q "SELECT ce.edge_id,
          cf.path as caller_file, ce.caller_symbol,
          ef.path as callee_file, ce.callee_symbol,
          ce.is_hot_path, ce.coupling
   FROM call_edges ce
   JOIN files cf ON ce.caller_file_id = cf.file_id
   JOIN files ef ON ce.callee_file_id = ef.file_id
   ORDER BY ce.coupling DESC" > "$OUT/call-edges.json"

# ── coverage.json
q "SELECT f.path as file, c.symbol_name, c.line_start, c.covered, c.test_file, c.test_name
   FROM coverage c JOIN files f ON c.file_id = f.file_id
   ORDER BY f.path, c.line_start" > "$OUT/coverage.json"

# ── churn.json
q "SELECT f.path as file, ch.commits_30d, ch.authors_30d, ch.lines_changed, ch.trend, ch.spark_7d
   FROM churn ch JOIN files f ON ch.file_id = f.file_id
   ORDER BY ch.commits_30d DESC" > "$OUT/churn.json"

# ── compliance.json
q "SELECT co.finding_id, f.path as file, co.line_no, co.rule_id, co.category, co.verdict, co.detail, co.timestamp
   FROM compliance co LEFT JOIN files f ON co.file_id = f.file_id
   ORDER BY co.finding_id" > "$OUT/compliance.json"

# ── incidents.json
q "SELECT i.incident_id, i.title, i.severity, f.path as root_file, i.root_line, i.root_symbol, i.explanation, i.confidence
   FROM incidents i LEFT JOIN files f ON i.root_file_id = f.file_id" > "$OUT/incidents.json"

# ── incident_trace.json
q "SELECT it.trace_id, it.incident_id, it.step_order, f.path as file, it.line_no, it.symbol, it.kind, it.summary
   FROM incident_trace it JOIN files f ON it.file_id = f.file_id
   ORDER BY it.incident_id, it.step_order" > "$OUT/incident-trace.json"

# ── services.json
q "SELECT service_id, name, owner, status FROM services" > "$OUT/services.json"

# ── service_edges.json
q "SELECT from_service, to_service, protocol, impacted FROM service_edges" > "$OUT/service-edges.json"

echo "✓ Extracted $(ls "$OUT"/*.json | wc -l | tr -d ' ') JSON files → $OUT/"
