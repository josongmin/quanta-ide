import { riskColor } from "@quanta/ui-kit/lib/risk";

export function FileInspectorHero({ name }: { name: string }) {
  const score = 78;
  const color = riskColor(score);

  return (
    <div className="insp__hero">
      <div className="hero__name" title={name}>{name}</div>

      <div className="hero__risk">
        <div className="hero__risk-head">
          <div className="hero__risk-figure">
            <span className="hero__risk-num" style={{ color }}>{score}</span>
            <span className="hero__risk-unit">/100</span>
          </div>
          <span
            className="hero__risk-pill"
            style={{
              color,
              background: `color-mix(in srgb, ${color} 8%, transparent)`,
            }}
          >
            High risk
          </span>
        </div>
        <div className="hero__risk-track" aria-hidden>
          <span className="hero__risk-fill" style={{ width: `${score}%`, background: color }} />
        </div>
      </div>

      <div className="hero__metrics">
        <div className="hero__metric">
          <span className="hero__metric-val">1,974</span>
          <span className="hero__metric-key">lines</span>
        </div>
        <div className="hero__metric">
          <span className="hero__metric-val">11</span>
          <span className="hero__metric-key">functions</span>
        </div>
        <div className="hero__metric">
          <span className="hero__metric-val">3</span>
          <span className="hero__metric-key">classes</span>
        </div>
        <div className="hero__metric">
          <span className="hero__metric-val">24</span>
          <span className="hero__metric-key">imports</span>
        </div>
        <div className="hero__metric">
          <span className="hero__metric-val">38</span>
          <span className="hero__metric-key">callers</span>
        </div>
        <div className="hero__metric">
          <span className="hero__metric-val">9</span>
          <span className="hero__metric-key">cpx peak</span>
        </div>
      </div>
    </div>
  );
}
