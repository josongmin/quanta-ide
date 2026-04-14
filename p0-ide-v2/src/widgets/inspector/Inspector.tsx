import "./inspector.css";
import {
  IconChevron,
  IconClass,
  IconClock,
  IconComplexity,
  IconDead,
  IconFunction,
  IconNoTests,
  IconPlay,
  IconTaint,
  IconTrendDown,
  IconTrendFlat,
  IconTrendUp,
  Sparkline,
} from "./icons";

const signals = [
  { kind: "danger", Icon: IconTaint, label: "Taint sink", detail: "experience_store.save — unguarded" },
  { kind: "warn", Icon: IconNoTests, label: "No tests", detail: "execute() has 0/12 tests" },
  { kind: "warn", Icon: IconComplexity, label: "High complexity", detail: "CPX 9.1 (threshold 8)" },
  { kind: "muted", Icon: IconDead, label: "Dead code", detail: "_select_strategy — unreferenced" },
];

const coverage = { pct: 0, uncovered: 8, files: 1 };
const coverageRows: { file: string; covered: number; total: number; delta: number }[] = [
  { file: "orchestrator.py", covered: 0, total: 8, delta: -8 },
];

type DeadConf = "high" | "med";
const deadCode: { kind: "fn" | "class" | "const"; name: string; loc: string; conf: DeadConf; strike?: boolean }[] = [
  { kind: "fn", name: "_legacy_inference_bridge", loc: "orchestrator.py:147", conf: "high", strike: true },
  { kind: "class", name: "OldRetryPolicy", loc: "orchestrator.py:153", conf: "high" },
  { kind: "const", name: "TEMP_FEATURE_FLAG", loc: "orchestrator.py:159", conf: "high", strike: true },
];

type ChurnTrend = "up" | "flat" | "down";
const churn: { file: string; trend: ChurnTrend; count: number; weight: number; spark: number[] }[] = [
  { file: "orchestrator.py", trend: "up", count: 28, weight: 1.0, spark: [4, 6, 5, 9, 12, 18, 28] },
  { file: "fee.py", trend: "up", count: 22, weight: 0.78, spark: [2, 3, 5, 7, 11, 15, 22] },
  { file: "security.py", trend: "up", count: 19, weight: 0.68, spark: [3, 4, 4, 6, 9, 14, 19] },
  { file: "webhook.py", trend: "flat", count: 18, weight: 0.65, spark: [12, 13, 12, 14, 13, 17, 18] },
  { file: "retry.py", trend: "flat", count: 15, weight: 0.55, spark: [10, 12, 11, 13, 14, 14, 15] },
  { file: "routing_policy.py", trend: "flat", count: 14, weight: 0.5, spark: [9, 11, 12, 11, 13, 13, 14] },
  { file: "ledger.py", trend: "down", count: 12, weight: 0.45, spark: [22, 19, 18, 16, 14, 12, 12] },
  { file: "billing.py", trend: "down", count: 9, weight: 0.32, spark: [18, 15, 13, 12, 11, 10, 9] },
  { file: "audit_store.py", trend: "down", count: 3, weight: 0.12, spark: [14, 11, 9, 7, 5, 4, 3] },
];

function riskColor(r: number): string {
  if (r >= 70) return "var(--danger)";
  if (r >= 40) return "var(--warn)";
  return "var(--success)";
}

function trendIcon(t: ChurnTrend) {
  if (t === "up") return <IconTrendUp size={13} />;
  if (t === "down") return <IconTrendDown size={13} />;
  return <IconTrendFlat size={13} />;
}

function symbolGlyph(kind: "fn" | "class" | "const") {
  if (kind === "class") return <IconClass size={13} />;
  if (kind === "const") return <span className="dead__kchar">k</span>;
  return <IconFunction size={13} />;
}

export function Inspector() {
  return (
    <aside className="inspector" aria-label="Inspector">
      <div className="insp__hero">
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
            <span
              className="hero__risk-fill"
              style={{ width: "78%", background: riskColor(78) }}
            />
            <span className="hero__risk-tick" style={{ left: "40%" }} />
            <span className="hero__risk-tick" style={{ left: "70%" }} />
          </div>
        </div>

        <div className="hero__stats hero__stats--scale">
          <div className="hero__stat">
            <span className="hero__stat-val">1,974</span>
            <span className="hero__stat-key">lines</span>
          </div>
          <div className="hero__stat">
            <span className="hero__stat-val">11</span>
            <span className="hero__stat-key">functions</span>
          </div>
          <div className="hero__stat">
            <span className="hero__stat-val">3</span>
            <span className="hero__stat-key">classes</span>
          </div>
        </div>

        <div className="hero__stats hero__stats--struct">
          <div className="hero__stat">
            <span className="hero__stat-val">24</span>
            <span className="hero__stat-key">imports</span>
          </div>
          <div className="hero__stat">
            <span className="hero__stat-val">38</span>
            <span className="hero__stat-key">callers</span>
          </div>
          <div className="hero__stat">
            <span className="hero__stat-val hero__stat-val--warn">9.1</span>
            <span className="hero__stat-key">cpx max</span>
          </div>
          <div className="hero__stat">
            <span className="hero__stat-val">6</span>
            <span className="hero__stat-key">authors</span>
          </div>
        </div>

        <div className="hero__meta">
          <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
            <circle cx="8" cy="8" r="6" />
            <polyline points="8 5 8 8 10.5 9.5" />
          </svg>
          <span>edited 2w ago</span>
          <span className="hero__meta-dot" aria-hidden />
          <span>18 commits</span>
        </div>
      </div>

      <Section label="Risk signals" count={signals.length}>
        <ul className="signals">
          {signals.map((s, i) => (
            <li key={i} className={`signal signal--${s.kind}`}>
              <span className="signal__glyph"><s.Icon size={14} /></span>
              <span className="signal__label">{s.label}</span>
              <span className="signal__detail">{s.detail}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Coverage gap">
        <div className="substats substats--3">
          <Sub k="Coverage" v={`${coverage.pct}%`} tone={coverage.pct < 50 ? "danger" : "default"} />
          <Sub k="Uncovered" v={String(coverage.uncovered)} />
          <Sub k="Files" v={String(coverage.files)} />
        </div>
        <ul className="cov">
          {coverageRows.map((r) => (
            <li key={r.file} className="cov__row">
              <span className="cov__file">{r.file}</span>
              <span className="cov__frac">{r.covered}/{r.total}</span>
              <div className="cov__bar">
                <span
                  className="cov__fill"
                  style={{ width: `${(r.covered / r.total) * 100}%`, background: "var(--success)" }}
                />
              </div>
              <span className="cov__delta">{r.delta > 0 ? `+${r.delta}` : r.delta}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Dead code">
        <div className="substats substats--2">
          <Sub k="Total" v={String(deadCode.length)} />
          <Sub k="High conf." v={String(deadCode.filter((d) => d.conf === "high").length)} />
        </div>
        <ul className="dead">
          {deadCode.map((d) => (
            <li key={d.name} className="dead__row">
              <span className="dead__glyph">{symbolGlyph(d.kind)}</span>
              <span className={"dead__name" + (d.strike ? " is-strike" : "")}>{d.name}</span>
              <span className="dead__loc">{d.loc}</span>
              <span className={`pill pill--conf-${d.conf}`}>{d.conf}</span>
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Churn hotspots">
        <div className="substats substats--3">
          <Sub k="Hotspots" v="9" />
          <Sub k="Rising" v="3" tone="warn" />
          <Sub k="Churn Δ" v="4850" />
        </div>
        <ul className="churn">
          {churn.map((c) => (
            <li key={c.file} className="churn__row">
              <span className="churn__file">{c.file}</span>
              <span className={`churn__trend churn__trend--${c.trend}`}>{trendIcon(c.trend)}</span>
              <span className="churn__count">{c.count}</span>
              <div className="churn__bar">
                <span className="churn__fill" style={{ width: `${Math.round(c.weight * 100)}%` }} />
              </div>
              <Sparkline points={c.spark} className="churn__spark" />
            </li>
          ))}
        </ul>
      </Section>

      <Section label="Suggested fix">
        <div className="fix">
          <div className="fix__title">Guard taint sink with input validator</div>
          <pre className="fix__code">{`+ if not trace.validated():
+     raise UnvalidatedTrace()
  self._store.save(trace)`}</pre>
          <div className="fix__meta">
            <div><span>Risk</span><b>78 → 12</b></div>
            <div><span>Confidence</span><b>0.92</b></div>
            <div><span>Affects</span><b>5 files</b></div>
          </div>
          <div className="fix__actions">
            <button className="btn btn--ghost">Dismiss <kbd>Esc</kbd></button>
            <button className="btn btn--primary">Apply <kbd>Enter</kbd></button>
          </div>
        </div>
      </Section>

      <footer className="insp__foot">
        <span className="insp__foot-item"><IconPlay size={11} /> .status.engine</span>
        <span className="insp__foot-item insp__foot-mid"><IconClock size={11} /> session 46m 53s</span>
        <span className="insp__foot-item">
          <span className="insp__foot-dot" /> connected
        </span>
      </footer>
    </aside>
  );
}

function Sub({
  k,
  v,
  tone = "default",
}: {
  k: string;
  v: string;
  tone?: "default" | "danger" | "warn";
}) {
  return (
    <div className="sub">
      <div className={`sub__v sub__v--${tone}`}>{v}</div>
      <div className="sub__k">{k}</div>
    </div>
  );
}

function Section({
  label,
  count,
  children,
}: {
  label: string;
  count?: number;
  children: React.ReactNode;
}) {
  return (
    <section className="insp__section">
      <header className="insp__section-h">
        <span className="insp__section-label">{label}</span>
        {count !== undefined && <span className="insp__section-count">{count}</span>}
        <IconChevron size={12} className="insp__section-chev" />
      </header>
      <div className="insp__section-body">{children}</div>
    </section>
  );
}
