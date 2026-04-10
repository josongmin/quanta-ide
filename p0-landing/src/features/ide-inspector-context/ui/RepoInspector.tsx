/* ── Repo Inspector — repository-level static analysis insights ── */

interface RiskFile { name: string; risk: number; issues: number; path: string; }
interface HotspotAuthor { name: string; riskOwned: number; files: number; }
interface RepoSignal { icon: string; label: string; severity: 1 | 2 | 3; detail: string; }

const REPO_DATA = {
  repoName: "payments-api",
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
    { icon: "⬇", severity: 3, label: "Taint sink 무방비", detail: "processRefund, authorize — 검증 없이 DB 기록" },
    { icon: "⊘", severity: 3, label: "테스트 커버리지 38%", detail: "14개 핵심 진입점 중 0개 테스트 완료" },
    { icon: "⚑", severity: 2, label: "Bus factor = 1", detail: "alice가 결제 경로 74% 단독 소유" },
    { icon: "◎", severity: 2, label: "Blast 반경 상위 3개", detail: "refund → 31개 파일, charge → 18개 파일" },
    { icon: "◌", severity: 1, label: "Dead symbol 8개", detail: "sendWebhook 외 7개 — 마지막 참조 3~6개월 전" },
  ] as RepoSignal[],
  riskFiles: [
    { name: "refund.ts",       path: "src/payments", risk: 78, issues: 5 },
    { name: "charge.ts",       path: "src/payments", risk: 52, issues: 3 },
    { name: "webhooks/notify.ts", path: "src",        risk: 61, issues: 2 },
    { name: "auth/session.ts", path: "src",           risk: 44, issues: 1 },
    { name: "orders/pay.ts",   path: "src",           risk: 44, issues: 1 },
  ] as RiskFile[],
  authors: [
    { name: "alice", riskOwned: 74, files: 18 },
    { name: "bob",   riskOwned: 58, files: 12 },
    { name: "carol", riskOwned: 23, files:  9 },
  ] as HotspotAuthor[],
};

/* ── helpers ── */
function riskColor(score: number) {
  if (score >= 60) return "var(--accent)";
  if (score >= 35) return "var(--token-str)";
  return "var(--token-ok)";
}

const SEV_CLASS: Record<1 | 2 | 3, string> = { 3: "is-crit", 2: "is-warn", 1: "is-info" };

/* ── sub-components ── */
function RiiSection({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="fii-section">
      <div className="fii-section-header">
        <span className="fii-section-label">{label}</span>
      </div>
      {children}
    </div>
  );
}

function ScoreRing({ score }: { score: number }) {
  const r = 22;
  const circ = 2 * Math.PI * r;
  const dash = (score / 100) * circ;
  const color = riskColor(score);
  return (
    <div className="rii-ring-wrap">
      <svg width="64" height="64" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r={r} fill="none" stroke="var(--line)" strokeWidth="5" />
        <circle
          cx="32" cy="32" r={r} fill="none"
          stroke={color} strokeWidth="5"
          strokeDasharray={`${dash} ${circ}`}
          strokeLinecap="round"
          transform="rotate(-90 32 32)"
        />
      </svg>
      <div className="rii-ring-label">
        <span className="rii-ring-score" style={{ color }}>{score}</span>
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
            <span className="fii-stat-label">파일</span>
            <span className="rii-meta-val">{d.analyzedFiles} / {d.totalFiles}</span>
          </div>
          <div className="rii-meta-row">
            <span className="fii-stat-label">LOC</span>
            <span className="rii-meta-val">{d.totalLoc.toLocaleString()}</span>
          </div>
          <div className="rii-meta-row">
            <span className="fii-stat-label">평균 복잡도</span>
            <span className="rii-meta-val">{d.avgComplexity}</span>
          </div>
          <div className="rii-meta-row">
            <span className="fii-stat-label">테스트 커버리지</span>
            <span className="rii-meta-val" style={{ color: d.testCoverage < 50 ? "var(--accent)" : "var(--token-ok)" }}>
              {d.testCoverage}%
            </span>
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

      {/* ── signals ── */}
      <RiiSection label="RISK SIGNALS">
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
      <RiiSection label="HIGH-RISK FILES">
        <div className="fii-heat">
          {d.riskFiles.map((f) => (
            <div key={f.name} className="fii-heat-row">
              <span className="fii-heat-loc" style={{ width: 52, flexShrink: 0 }}>{f.issues}건</span>
              <span className="fii-heat-name">{f.name}</span>
              <div className="fii-heat-bar-wrap">
                <div className="fii-heat-bar" style={{ width: `${f.risk}%`, background: riskColor(f.risk) }} />
              </div>
              <span className="fii-heat-cpx" style={{ color: riskColor(f.risk) }}>{f.risk}</span>
            </div>
          ))}
        </div>
      </RiiSection>

      {/* ── ownership risk ── */}
      <RiiSection label="OWNERSHIP RISK">
        {d.authors.map((a) => (
          <div key={a.name} className="fii-owner-row">
            <span className="fii-owner-avatar">{a.name[0].toUpperCase()}</span>
            <span className="fii-owner-name">{a.name}</span>
            <div className="fii-owner-bar">
              <div className="fii-owner-fill" style={{ width: `${a.riskOwned}%`, background: riskColor(a.riskOwned) }} />
            </div>
            <span className="fii-owner-pct">{a.riskOwned}%</span>
          </div>
        ))}
      </RiiSection>
    </div>
  );
}
