import { riskBand } from "@/entities/pr";

export function RiskGauge({ risk }: { risk: number }) {
  const rad = (risk - 1) * Math.PI;
  const endX = 60 + 50 * Math.cos(rad);
  const endY = 60 + 50 * Math.sin(rad);
  const needleX = 60 + 38 * Math.cos(rad);
  const needleY = 60 + 38 * Math.sin(rad);
  const band = riskBand(risk);
  return (
    <div className={`pr-page__gauge pr-page__gauge--${band}`}>
      <svg viewBox="0 0 120 70">
        <path d="M 10 60 A 50 50 0 0 1 110 60" stroke="currentColor" strokeOpacity="0.15" strokeWidth="8" fill="none" strokeLinecap="round" />
        <path
          d={`M 10 60 A 50 50 0 0 1 ${endX} ${endY}`}
          stroke="currentColor"
          strokeWidth="8"
          fill="none"
          strokeLinecap="round"
        />
        <line x1="60" y1="60" x2={needleX} y2={needleY} stroke="var(--fg)" strokeWidth="2" strokeLinecap="round" />
        <circle cx="60" cy="60" r="2.5" fill="var(--fg)" />
      </svg>
      <div className="pr-page__gauge-value">{risk.toFixed(2)}</div>
      <div className="pr-page__gauge-label">Structural risk</div>
    </div>
  );
}

/* ─────────── icons ─────────── */

