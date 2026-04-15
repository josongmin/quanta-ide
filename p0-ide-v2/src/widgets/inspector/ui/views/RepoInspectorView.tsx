import { Section } from "@/shared/ui/section";
import { riskBarStyle } from "@/shared/lib/risk";
import { focusStore, useFocusStore, type InspectorMode } from "@/shared/model/focus-store";
import { INSPECTOR_MODES } from "@/entities/inspector";

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

const SEV_CLASS: Record<1 | 2 | 3, string> = { 3: "is-crit", 2: "is-warn", 1: "is-info" };

const MODES = INSPECTOR_MODES;

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  return (
    <div className="ring">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--border)" strokeWidth="5" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke="var(--accent)" strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
      </svg>
      <div className="ring__label">
        <span className="ring__score">{score}</span>
        <span className="ring__sub">RISK</span>
      </div>
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rstat">
      <span className="rstat__label">{label}</span>
      <span className={"rstat__value" + (accent ? " is-accent" : "")}>{value}</span>
    </div>
  );
}

export function RepoInspectorView({ name }: { name: string }) {
  const d = REPO_DATA;
  const mode = useFocusStore((s) => s.mode);

  const tabCounts: Partial<Record<InspectorMode, number>> = {
    flow: d.taintPaths,
    blast: d.blastHotspots,
    incidents: d.signals.filter((s) => s.severity === 3).length,
    ownership: d.authors.length,
  };

  return (
    <>
      <nav className="insp__modes" role="tablist" aria-label="Inspector mode">
        {MODES.map((m) => {
          const active = m.id === mode;
          const count = tabCounts[m.id];
          return (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={active}
              className={`insp__mode${active ? " is-active" : ""}`}
              onClick={() => focusStore.setMode(m.id)}
            >
              <span>{m.label}</span>
              {count !== undefined && count > 0 && (
                <span className="insp__mode-count">{count}</span>
              )}
            </button>
          );
        })}
      </nav>

      {mode !== "overview" && (
        <div className="empty-pane">
          {modeLabel(mode)} view for repo is coming soon.
        </div>
      )}

      {mode === "overview" && (
      <>
      <div className="insp__hero insp__hero--repo">
        <div className="hero__name" title={name}>{name}</div>
        <div className="rii-header">
          <ScoreRing score={d.repoRisk} />
          <div className="rii-meta">
            <div className="rii-meta-row"><span className="rstat__label">FILES</span><span className="rii-meta-val">{d.analyzedFiles} / {d.totalFiles}</span></div>
            <div className="rii-meta-row"><span className="rstat__label">LOC</span><span className="rii-meta-val">{d.totalLoc.toLocaleString()}</span></div>
            <div className="rii-meta-row"><span className="rstat__label">AVG CPX</span><span className="rii-meta-val">{d.avgComplexity}</span></div>
            <div className="rii-meta-row"><span className="rstat__label">COVERAGE</span><span className="rii-meta-val">{d.testCoverage}%</span></div>
          </div>
        </div>

        <div className="rii-stats">
          <Stat label="TAINT" value={d.taintPaths} accent={d.taintPaths > 0} />
          <Stat label="DEAD" value={d.deadSymbols} accent={d.deadSymbols > 0} />
          <Stat label="BUS" value={d.busFactor} accent={d.busFactor <= 1} />
          <Stat label="BLAST" value={`×${d.blastHotspots}`} />
        </div>
      </div>

      <Section label="Risk signals" count={d.signals.length}>
        <div className="rsig">
          {d.signals.map((s, i) => (
            <div key={i} className={`rsig__row ${SEV_CLASS[s.severity]}`}>
              <span className="rsig__icon">{s.icon}</span>
              <div className="rsig__text">
                <span className="rsig__label">{s.label}</span>
                <span className="rsig__detail">{s.detail}</span>
              </div>
            </div>
          ))}
        </div>
      </Section>

      <Section label="High-risk files" count={d.riskFiles.length}>
        <div className="rheat">
          {d.riskFiles.map((f) => (
            <div key={f.name} className="rheat__row">
              <span className="rheat__issues">{f.issues}</span>
              <span className="rheat__name">{f.name}</span>
              <div className="rheat__bar"><div className="rheat__fill" style={riskBarStyle(f.risk)} /></div>
              <span className="rheat__val">{f.risk}</span>
            </div>
          ))}
        </div>
      </Section>

      <Section label="Ownership risk" count={d.authors.length}>
        <div className="rown">
          {d.authors.map((a) => (
            <div key={a.name} className="rown__row">
              <span className="rown__avatar">{a.name[1]?.toUpperCase() ?? a.name[0]}</span>
              <span className="rown__name">{a.name}</span>
              <div className="rown__bar"><div className="rown__fill" style={riskBarStyle(a.riskOwned)} /></div>
              <span className="rown__pct">{a.riskOwned}%</span>
            </div>
          ))}
        </div>
      </Section>
      </>
      )}
    </>
  );
}

function modeLabel(mode: InspectorMode): string {
  const hit = MODES.find((x) => x.id === mode);
  return hit ? hit.label : "";
}
