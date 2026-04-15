import { riskColor } from "@/shared/lib/risk";

export function RiskDelta({ before, after }: { before: number; after: number }) {
  const drop = before - after;
  const dropPct = before > 0 ? Math.round((drop / before) * 100) : 0;
  return (
    <div className="rdelta">
      <div className="rdelta__side">
        <RiskRing score={before} />
        <span className="rdelta__label">before</span>
      </div>
      <div className="rdelta__bridge" aria-hidden>
        <span className="rdelta__bridge-arrow">→</span>
        <span className="rdelta__bridge-delta">−{drop}</span>
        <span className="rdelta__bridge-pct">({dropPct}%)</span>
      </div>
      <div className="rdelta__side">
        <RiskRing score={after} />
        <span className="rdelta__label">after</span>
      </div>
    </div>
  );
}

function RiskRing({ score }: { score: number }) {
  const r = 22;
  const circumference = 2 * Math.PI * r;
  const pct = Math.max(0, Math.min(1, score / 100));
  const color = riskColor(score);
  return (
    <div className="rring">
      <svg className="rring__svg" width="60" height="60" viewBox="0 0 60 60" aria-hidden>
        <circle cx="30" cy="30" r={r} fill="none" stroke="var(--border)" strokeWidth="3" />
        <circle
          cx="30"
          cy="30"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="3"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={circumference * (1 - pct)}
          transform="rotate(-90 30 30)"
        />
      </svg>
      <span className="rring__score" style={{ color }}>{score}</span>
    </div>
  );
}
