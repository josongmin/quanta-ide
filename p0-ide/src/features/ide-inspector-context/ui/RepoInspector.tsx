/* ── Repo Inspector — repository-level static analysis insights ── */

import { PrLocTrendsPanel } from "@/features/ide-pr-loc-trends";

interface RiskFile { name: string; risk: number; issues: number; path: string; }
interface HotspotAuthor { name: string; riskOwned: number; files: number; }
interface RepoSignal { icon: string; label: string; severity: 1 | 2 | 3; detail: string; }

const REPO_DATA = {
  repoName: "codegraph-agent",
  totalFiles: 47,
  analyzedFiles: 47,
  totalLoc: 6_812,
  avgComplexity: 4.7,
  repoRisk: 64,
  taintPaths: 5,
  deadSymbols: 8,
  testCoverage: 38,
  busFactor: 1,
  blastHotspots: 3,
  signals: [
    { icon: "⬇", severity: 3, label: "Unguarded taint sinks", detail: "execute(), save() — tainted strategy written to DB without validation" },
    { icon: "⊘", severity: 3, label: "Test coverage 38%", detail: "0 of 14 critical entrypoints covered by tests" },
    { icon: "⚑", severity: 2, label: "Bus factor = 1", detail: "@songmin owns 74% of the high-risk execution path" },
    { icon: "◎", severity: 2, label: "3 blast-radius hotspots", detail: "execute → 38 files, _select_strategy → 21 files" },
    { icon: "◌", severity: 1, label: "8 dead symbols", detail: "_legacy_inference_bridge +7 — last touched 3–6 months ago" },
  ] as RepoSignal[],
  riskFiles: [
    { name: "orchestrator.py",  path: "codegraph_agent", risk: 78, issues: 5 },
    { name: "security.py",      path: "codegraph_agent", risk: 52, issues: 3 },
    { name: "routing_policy.py",path: "orchestrator",    risk: 44, issues: 2 },
    { name: "audit_store.py",   path: "shared",          risk: 23, issues: 1 },
    { name: "domain/models.py", path: "domain",          risk: 18, issues: 1 },
  ] as RiskFile[],
  authors: [
    { name: "@songmin",    riskOwned: 74, files: 18 },
    { name: "@devops-bot", riskOwned: 28, files: 12 },
    { name: "@carol",      riskOwned: 14, files:  9 },
  ] as HotspotAuthor[],
};

/* ── helpers ── */
function riskBarStyle(score: number): React.CSSProperties {
  // single accent color, opacity scales with risk — stays coherent across all themes
  const opacity = 0.35 + (score / 100) * 0.65;
  return { width: `${score}%`, background: "var(--accent)", opacity };
}

const SEV_CLASS: Record<1 | 2 | 3, string> = { 3: "is-crit", 2: "is-warn", 1: "is-info" };

/* ── sub-components ── */
function RiiSection({ label, count, children }: { label: string; count?: number; children: React.ReactNode }) {
  return (
    <div className="fii-section">
      <div className="fii-section-header">
        <span className="fii-section-label">{label}</span>
        {count !== undefined && <span className="fii-section-count">{count}</span>}
      </div>
      {children}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="rii-ring-wrap">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke="var(--accent)" strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
      </svg>
      <div className="rii-ring-label">
        <span className="rii-ring-score">{score}</span>
        <span className="rii-ring-sub">RISK</span>
      </div>
    </div>
  );
}

function StatChip({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="fii-stat">
      <span className="fii-stat-label">{label}</span>
      <span className="fii-stat-value" style={accent ? { color: "var(--accent)" } : undefined}>{value}</span>
    </div>
  );
}

export function RepoInspector() {
  const d = REPO_DATA;
  return (
    <div className="fii-root">
      {/* ── header summary ── */}
      <div className="rii-header">
        <ScoreRing score={d.repoRisk} />
        <div className="rii-meta">
          <div className="rii-meta-row">
            <span className="fii-stat-label">FILES</span>
            <span className="rii-meta-val">{d.analyzedFiles} / {d.totalFiles}</span>
          </div>
          <div className="rii-meta-row">
            <span className="fii-stat-label">LOC</span>
            <span className="rii-meta-val">{d.totalLoc.toLocaleString()}</span>
          </div>
          <div className="rii-meta-row">
            <span className="fii-stat-label">AVG CPX</span>
            <span className="rii-meta-val">{d.avgComplexity}</span>
          </div>
          <div className="rii-meta-row">
            <span className="fii-stat-label">COVERAGE</span>
            <span className="rii-meta-val">{d.testCoverage}%</span>
          </div>
        </div>
      </div>

      {/* ── stat grid ── */}
      <div className="fii-stats">
        <StatChip label="TAINT"  value={d.taintPaths}  accent={d.taintPaths > 0} />
        <StatChip label="DEAD"   value={d.deadSymbols} accent={d.deadSymbols > 0} />
        <StatChip label="BUS"    value={d.busFactor}   accent={d.busFactor <= 1} />
        <StatChip label="BLAST"  value={`×${d.blastHotspots}`} />
      </div>

      <PrLocTrendsPanel />

      {/* ── signals ── */}
      <RiiSection label="RISK SIGNALS" count={d.signals.length}>
        <div className="fii-signals">
          {d.signals.map((s, i) => (
            <div key={i} className={`fii-signal ${SEV_CLASS[s.severity]}`}>
              <span className="fii-signal-icon">{s.icon}</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 1, flex: 1 }}>
                <span className="fii-signal-msg">{s.label}</span>
                <span style={{ fontSize: "0.61rem", color: "var(--ink-4)", lineHeight: 1.3 }}>{s.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </RiiSection>

      {/* ── high-risk files ── */}
      <RiiSection label="HIGH-RISK FILES" count={d.riskFiles.length}>
        <div className="fii-heat">
          {d.riskFiles.map((f) => (
            <div key={f.name} className="fii-heat-row">
              <span className="fii-heat-loc">{f.issues}</span>
              <span className="fii-heat-name">{f.name}</span>
              <div className="fii-heat-bar-wrap">
                <div className="fii-heat-bar" style={riskBarStyle(f.risk)} />
              </div>
              <span className="fii-heat-cpx">{f.risk}</span>
            </div>
          ))}
        </div>
      </RiiSection>

      {/* ── ownership risk ── */}
      <RiiSection label="OWNERSHIP RISK" count={d.authors.length}>
        {d.authors.map((a) => (
          <div key={a.name} className="fii-owner-row">
            <span className="fii-owner-avatar">{a.name[0].toUpperCase()}</span>
            <span className="fii-owner-name">{a.name}</span>
            <div className="fii-owner-bar">
              <div className="fii-owner-fill" style={riskBarStyle(a.riskOwned)} />
            </div>
            <span className="fii-owner-pct">{a.riskOwned}%</span>
          </div>
        ))}
      </RiiSection>
    </div>
  );
}
