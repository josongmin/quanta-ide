interface FnHeaderProps {
  funcName: string;
  loc: string;
  riskScore: number;
  cpx: string;
  callers: string;
  tests: string;
  blast: string;
}

function riskColor(score: number): string {
  if (score >= 70) return "var(--token-err)";
  if (score >= 40) return "var(--token-str)";
  return "var(--token-ok)";
}

export function FnHeader({ funcName, loc, riskScore, cpx, callers, tests, blast }: FnHeaderProps) {
  const color = riskColor(riskScore);
  return (
    <div className="ifnh-card">
      <div className="ifnh-top-row">
        <span className="ifnh-fn-name">{funcName}</span>
        <span className="ifnh-loc">{loc}</span>
        <span className="ifnh-risk-badge" style={{ color, borderColor: color }}>
          <span className="ifnh-risk-dot" style={{ background: color }} />
          RISK {riskScore}
        </span>
      </div>
      <div className="ifnh-chips">
        <div className="ifnh-chip">
          <span className="ifnh-chip-label">CPX</span>
          <span className="ifnh-chip-value">{cpx}</span>
        </div>
        <div className="ifnh-chip">
          <span className="ifnh-chip-label">CALLERS</span>
          <span className="ifnh-chip-value">{callers}</span>
        </div>
        <div className="ifnh-chip">
          <span className="ifnh-chip-label">TESTS</span>
          <span className="ifnh-chip-value">{tests}</span>
        </div>
        <div className="ifnh-chip">
          <span className="ifnh-chip-label">BLAST</span>
          <span className="ifnh-chip-value">{blast}</span>
        </div>
      </div>
    </div>
  );
}
