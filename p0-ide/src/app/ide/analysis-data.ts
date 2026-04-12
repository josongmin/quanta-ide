/**
 * Analysis data adapter — reads pre-extracted JSON from the analysis DB
 * and exposes typed data for IDE panels.
 *
 * Data flow: SQLite DB → extract.sh → JSON → this adapter → IDE panels
 */

import symbolsJson from "@analysis/symbols.json";
import coverageJson from "@analysis/coverage.json";
import churnJson from "@analysis/churn.json";
import complianceJson from "@analysis/compliance.json";

/* ── Types ──────────────────────────────────────────────────────────── */

interface AnalysisSymbol {
  file: string;
  name: string;
  kind: string;
  line_start: number;
  line_end: number | null;
  complexity: number | null;
  is_dead: number;
  dead_reason: string | null;
  last_called: string | null;
}

interface AnalysisCoverage {
  file: string;
  symbol_name: string;
  line_start: number;
  covered: number;
  test_file: string | null;
  test_name: string | null;
}

interface AnalysisChurn {
  file: string;
  commits_30d: number;
  authors_30d: number;
  lines_changed: number;
  trend: "rising" | "stable" | "falling";
  spark_7d: string;
}

interface AnalysisCompliance {
  finding_id: number;
  file: string | null;
  line_no: number | null;
  rule_id: string;
  category: string;
  verdict: "pass" | "fail" | "warn";
  detail: string;
  timestamp: string;
}

/* ── Cast raw JSON ─────────────────────────────────────────────────── */

const symbols = symbolsJson as AnalysisSymbol[];
const coverage = coverageJson as AnalysisCoverage[];
const churn = churnJson as AnalysisChurn[];
const compliance = complianceJson as AnalysisCompliance[];

/* ── File path mapping (IDE uses short names) ──────────────────────── */

const FILE_ALIAS: Partial<Record<string, string[]>> = {
  "orchestrator.py": ["codegraph_agent/orchestrator/orchestrator.py"],
  "routing_policy.py": ["codegraph_agent/orchestrator/routing_policy.py"],
  "security.py": ["codegraph_agent/tools/plan_orchestration/security.py"],
  "audit_store.py": ["infrastructure/audit_store.py"],
};

function matchFile(shortName: string, fullPath: string): boolean {
  const aliases = FILE_ALIAS[shortName];
  if (aliases !== undefined) return aliases.includes(fullPath);
  return fullPath.endsWith(shortName);
}

/* ── Public API ─────────────────────────────────────────────────────── */

export function getDeadSymbolsFromDB(fileName: string) {
  return symbols
    .filter((s) => s.is_dead === 1 && matchFile(fileName, s.file))
    .map((s) => ({
      id: `dead-${s.file}-${s.line_start.toString()}`,
      name: s.name,
      kind: s.kind as "function" | "class" | "type" | "const" | "method",
      file: s.file.split("/").pop() ?? s.file,
      line: s.line_start,
      lastCalled: s.last_called,
      confidence: "high" as const,
      reason: s.dead_reason ?? "No references found",
    }));
}

export function getCoverageFromDB(fileName: string) {
  const fileSymbols = coverage.filter((c) => matchFile(fileName, c.file));

  // Group by file
  const byFile = new Map<string, typeof fileSymbols>();
  for (const c of fileSymbols) {
    const short = c.file.split("/").pop() ?? c.file;
    const arr = byFile.get(short) ?? [];
    arr.push(c);
    byFile.set(short, arr);
  }

  return Array.from(byFile.entries()).map(([file, items]) => ({
    id: `cg-${file}`,
    file,
    covered: items.filter((i) => i.covered === 1).length,
    total: items.length,
    uncovered: items
      .filter((i) => i.covered === 0)
      .map((i) => ({
        name: i.symbol_name,
        kind: "function" as const,
        line: i.line_start,
        risk: 3 as 1 | 2 | 3 | 4,
      })),
  }));
}

export function getChurnFromDB(fileName: string) {
  // Return all churn data, sorted by commits — the "related files" view
  const all = churn.map((c) => ({
    id: `churn-${c.file}`,
    file: c.file.split("/").pop() ?? c.file,
    commits30d: c.commits_30d,
    authors: c.authors_30d,
    churnLines: c.lines_changed,
    riskTrend: c.trend,
    spark: JSON.parse(c.spark_7d) as number[],
  }));

  // Put the active file first
  return all.sort((a, b) => {
    const aMatch = a.file === fileName || fileName.endsWith(a.file) ? 1 : 0;
    const bMatch = b.file === fileName || fileName.endsWith(b.file) ? 1 : 0;
    if (bMatch !== aMatch) return bMatch - aMatch;
    return b.commits30d - a.commits30d;
  });
}

export function getComplianceFromDB() {
  return compliance.map((c) => ({
    id: `a${c.finding_id.toString()}`,
    rule: c.rule_id,
    category: c.category as "taint" | "auth" | "data" | "crypto" | "logging",
    verdict: c.verdict,
    detail: c.detail,
    loc: c.file !== null && c.line_no !== null
      ? `${c.file.split("/").pop() ?? c.file}:${c.line_no.toString()}`
      : undefined,
    timestamp: c.timestamp,
  }));
}

/** Summary stats derived from DB */
export function getAnalysisSummary(fileName: string) {
  const dead = symbols.filter((s) => s.is_dead === 1 && matchFile(fileName, s.file)).length;
  const uncovered = coverage.filter((c) => c.covered === 0 && matchFile(fileName, c.file)).length;
  const total = coverage.filter((c) => matchFile(fileName, c.file)).length;
  const fileChurn = churn.find((c) => matchFile(fileName, c.file));

  return {
    deadCount: dead,
    uncoveredCount: uncovered,
    totalSymbols: total,
    coveragePct: total > 0 ? Math.round(((total - uncovered) / total) * 100) : 100,
    commits30d: fileChurn?.commits_30d ?? 0,
    churnTrend: fileChurn?.trend ?? "stable",
  };
}
