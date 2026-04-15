import { riskColor } from "@/shared/lib/risk";

export function FileInspectorHero({ name }: { name: string }) {
  return (
    <div className="insp__hero">
      <div className="hero__name" title={name}>{name}</div>
      <div className="hero__risk">
        <div className="hero__risk-head">
          <div className="hero__risk-figure">
            <span className="hero__risk-num" style={{ color: riskColor(78) }}>78</span>
            <span className="hero__risk-unit">/100</span>
          </div>
          <span
            className="hero__risk-pill"
            style={{
              color: riskColor(78),
              background: `color-mix(in srgb, ${riskColor(78)} 10%, transparent)`,
            }}
          >
            <span className="hero__risk-dot" style={{ background: riskColor(78) }} />
            High risk
          </span>
        </div>
        <div className="hero__risk-track" aria-hidden>
          <span className="hero__risk-fill" style={{ width: "78%", background: riskColor(78) }} />
          <span className="hero__risk-tick" style={{ left: "40%" }} />
          <span className="hero__risk-tick" style={{ left: "70%" }} />
        </div>
      </div>

      <div className="hero__stats hero__stats--scale">
        <div className="hero__stat">
          <span className="hero__stat-head">
            <span className="hero__stat-glyph">☰</span>
            <span className="hero__stat-val">1,974</span>
          </span>
          <span className="hero__stat-key">lines</span>
        </div>
        <div className="hero__stat">
          <span className="hero__stat-head">
            <span className="hero__stat-glyph">ƒ</span>
            <span className="hero__stat-val">11</span>
          </span>
          <span className="hero__stat-key">functions</span>
        </div>
        <div className="hero__stat">
          <span className="hero__stat-head">
            <span className="hero__stat-glyph">C</span>
            <span className="hero__stat-val">3</span>
          </span>
          <span className="hero__stat-key">classes</span>
        </div>
      </div>

      <div className="hero__stats hero__stats--struct">
        <div className="hero__stat">
          <span className="hero__stat-head">
            <span className="hero__stat-glyph">↓</span>
            <span className="hero__stat-val">24</span>
          </span>
          <span className="hero__stat-key">imports</span>
        </div>
        <div className="hero__stat">
          <span className="hero__stat-head">
            <span className="hero__stat-glyph">→</span>
            <span className="hero__stat-val">38</span>
          </span>
          <span className="hero__stat-key">callers</span>
        </div>
        <div className="hero__stat">
          <span className="hero__stat-head">
            <span className="hero__stat-glyph hero__stat-glyph--warn">λ</span>
            <span className="hero__stat-val hero__stat-val--warn">9</span>
          </span>
          <span className="hero__stat-key">cpx max</span>
        </div>
      </div>
    </div>
  );
}
