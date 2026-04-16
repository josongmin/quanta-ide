export function ScoreRing({ score }: { score: number }) {
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

export function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="rstat">
      <span className="rstat__label">{label}</span>
      <span className={"rstat__value" + (accent ? " is-accent" : "")}>{value}</span>
    </div>
  );
}
