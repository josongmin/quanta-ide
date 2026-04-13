import type { WatcherSnapshot, HeatmapCell } from "./types";

/* ── Heatmap: 프로젝트 전체 파일 현황 ─────────────────────────────── */
const heatmap: HeatmapCell[] = [
  // AI가 지금 수정 중
  { id: "h1",  file: "codegraph_agent/orchestrator.py",      shortName: "orchestrator.py",      churn: 31, heat: "active", editing: true,  summary: "Reduce cyclomatic complexity",         linesAdded: 23, linesRemoved: 8,  guardHit: "max-complexity", testStatus: "pass",    agoSec: 12 },
  { id: "h2",  file: "codegraph_agent/strategy_selector.py", shortName: "strategy_selector.py", churn: 76, heat: "active", editing: true,  summary: "Replace if/elif with match",            linesAdded: 45, linesRemoved: 31, testStatus: "fail",    agoSec: 34 },
  // 수정 완료 — clean
  { id: "h3",  file: "orchestrator/routing_policy.py",       shortName: "routing_policy.py",    churn: 17, heat: "clean",  editing: false, summary: "Remove unused import",                  linesAdded: 5,  linesRemoved: 12, testStatus: "pass",    agoSec: 67 },
  { id: "h4",  file: "codegraph_agent/graph_builder.py",     shortName: "graph_builder.py",     churn: 8,  heat: "clean",  editing: false, summary: "Fix edge dedup logic",                  linesAdded: 6,  linesRemoved: 2,  testStatus: "pass",    agoSec: 120 },
  { id: "h5",  file: "api/routes/health.py",                 shortName: "health.py",            churn: 3,  heat: "clean",  editing: false, summary: "Add timeout param",                     linesAdded: 3,  linesRemoved: 0,  testStatus: "pass",    agoSec: 180 },
  // 위험 — block
  { id: "h6",  file: "codegraph_agent/security.py",          shortName: "security.py",          churn: 11, heat: "block",  editing: false, summary: "Parameterize SQL query builder",        linesAdded: 8,  linesRemoved: 3,  guardHit: "no-sql-concat", testStatus: "running", agoSec: 89 },
  // 경고
  { id: "h7",  file: "codegraph_agent/inference_bridge.py",  shortName: "inference_bridge.py",  churn: 22, heat: "warn",   editing: false, summary: "Deprecation path needs review",         linesAdded: 14, linesRemoved: 8,  guardHit: "deprecated-api", testStatus: "none", agoSec: 145 },
  { id: "h8",  file: "tests/test_strategy_routing.py",       shortName: "test_strategy_routing.py", churn: 5, heat: "warn", editing: false, summary: "Assertions updated for match rewrite",  linesAdded: 5, linesRemoved: 0, testStatus: "fail", agoSec: 40 },
  // 미변경 파일들 (idle) — 프로젝트 전체 느낌
  { id: "h9",  file: "codegraph_agent/__init__.py",          shortName: "__init__.py",          churn: 0, heat: "idle", editing: false },
  { id: "h10", file: "codegraph_agent/config.py",            shortName: "config.py",            churn: 0, heat: "idle", editing: false },
  { id: "h11", file: "codegraph_agent/embeddings.py",        shortName: "embeddings.py",        churn: 0, heat: "idle", editing: false },
  { id: "h12", file: "codegraph_agent/indexer.py",           shortName: "indexer.py",           churn: 0, heat: "idle", editing: false },
  { id: "h13", file: "codegraph_agent/llm_client.py",        shortName: "llm_client.py",        churn: 0, heat: "idle", editing: false },
  { id: "h14", file: "codegraph_agent/parser.py",            shortName: "parser.py",            churn: 0, heat: "idle", editing: false },
  { id: "h15", file: "codegraph_agent/resolver.py",          shortName: "resolver.py",          churn: 0, heat: "idle", editing: false },
  { id: "h16", file: "api/routes/analyze.py",                shortName: "analyze.py",           churn: 0, heat: "idle", editing: false },
  { id: "h17", file: "api/routes/query.py",                  shortName: "query.py",             churn: 0, heat: "idle", editing: false },
  { id: "h18", file: "api/middleware/auth.py",                shortName: "auth.py",              churn: 0, heat: "idle", editing: false },
  { id: "h19", file: "api/middleware/rate_limit.py",          shortName: "rate_limit.py",        churn: 0, heat: "idle", editing: false },
  { id: "h20", file: "tests/test_resolve_policy.py",         shortName: "test_resolve_policy.py", churn: 0, heat: "idle", editing: false },
  { id: "h21", file: "tests/test_graph_builder.py",          shortName: "test_graph_builder.py",  churn: 0, heat: "idle", editing: false },
  { id: "h22", file: "tests/test_sql_injection.py",          shortName: "test_sql_injection.py",  churn: 0, heat: "idle", editing: false },
  { id: "h23", file: "tests/test_api_paths.py",              shortName: "test_api_paths.py",      churn: 0, heat: "idle", editing: false },
  { id: "h24", file: "tests/conftest.py",                    shortName: "conftest.py",            churn: 0, heat: "idle", editing: false },
  { id: "h25", file: "pyproject.toml",                       shortName: "pyproject.toml",         churn: 0, heat: "idle", editing: false },
  { id: "h26", file: "docker-compose.yml",                   shortName: "docker-compose.yml",     churn: 0, heat: "idle", editing: false },
  { id: "h27", file: "Makefile",                             shortName: "Makefile",               churn: 0, heat: "idle", editing: false },
  { id: "h28", file: ".github/workflows/ci.yml",             shortName: "ci.yml",                 churn: 0, heat: "idle", editing: false },
];

export const MOCK_WATCHER_SNAPSHOT: WatcherSnapshot = {
  impactedFiles: 8,
  status: "in-flux",
  trend: "diverging",
  series: [2, 3, 5, 5, 6, 7, 8, 8],
  peak: 8,
  nowWatching: [
    { id: "f1", label: "strategy_selector.py", reason: "high churn", kind: "file" },
    { id: "p1", label: "2 API paths potentially affected", kind: "api-path" },
  ],
  liveDiff: [
    { id: "d1", file: "orchestrator.py",       linesAdded: 23, linesRemoved: 8,  summary: "Reduce cyclomatic complexity",     agoSec: 12 },
    { id: "d2", file: "strategy_selector.py",  linesAdded: 45, linesRemoved: 31, summary: "Replace if/elif with match",       agoSec: 34 },
    { id: "d3", file: "routing_policy.py",     linesAdded: 5,  linesRemoved: 12, summary: "Remove unused import",             agoSec: 67 },
    { id: "d4", file: "security.py",           linesAdded: 8,  linesRemoved: 3,  summary: "Parameterize SQL query builder",   agoSec: 89 },
  ],
  guard: {
    passed: 14,
    warnings: 2,
    blocked: 1,
    rules: [
      { id: "g1", rule: "no-sql-concat",  severity: "block", file: "security.py" },
      { id: "g2", rule: "max-complexity",  severity: "warn",  file: "orchestrator.py" },
      { id: "g3", rule: "deprecated-api",  severity: "warn",  file: "inference_bridge.py" },
    ],
  },
  testPulse: [
    { id: "t1", name: "test_resolve_policy",     status: "pass",    durationMs: 230 },
    { id: "t2", name: "test_strategy_routing",    status: "fail",    durationMs: 1450 },
    { id: "t3", name: "test_sql_injection_guard", status: "running" },
    { id: "t4", name: "test_api_path_resolution", status: "pass",    durationMs: 89 },
    { id: "t5", name: "test_legacy_bridge",       status: "pending" },
  ],
  rollbackStack: [
    { id: "r1", label: "Before SQL refactor",   filesChanged: 2, agoSec: 89 },
    { id: "r2", label: "Before match rewrite",  filesChanged: 1, agoSec: 34 },
    { id: "r3", label: "Session start",         filesChanged: 0, agoSec: 420 },
  ],
  heatmap,
};
