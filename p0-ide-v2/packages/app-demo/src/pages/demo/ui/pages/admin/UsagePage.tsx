import { useMemo } from "react";
import { ArrowUp, ArrowDown } from "lucide-react";
import { DemoAppHero } from "../../internal/DemoAppHero";

function bars(n: number, seed: number) {
  const out: number[] = [];
  let s = seed;
  for (let i = 0; i < n; i++) {
    s = (s * 9301 + 49297) % 233280;
    out.push(0.35 + (s / 233280) * 0.65);
  }
  return out;
}

function Sparkline({ values, color = "var(--fg)" }: { values: number[]; color?: string }) {
  const w = 220, h = 48, step = w / (values.length - 1);
  const path = useMemo(() => {
    return values.map((v, i) => `${i === 0 ? "M" : "L"}${(i * step).toFixed(1)},${(h - v * (h - 4) - 2).toFixed(1)}`).join(" ");
  }, [values, step]);
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden>
      <path d={path} fill="none" stroke={color} strokeWidth={1.6} strokeLinejoin="round" />
    </svg>
  );
}

export function UsagePage() {
  const tokens = bars(14, 42);
  const minutes = bars(14, 99);
  const seats = bars(14, 7);

  return (
    <div className="demo-app">
      <DemoAppHero
        kicker="Admin"
        title="Usage dashboard"
        sub="Last 14 days across your workspace. Resets on the 1st of each month."
      />
      <div className="demo-app__body">
        <div className="demo-grid-3" style={{ marginBottom: 16 }}>
          <div className="demo-stat">
            <div className="demo-stat__label">AI tokens</div>
            <div className="demo-stat__value">1.42M</div>
            <div className="demo-stat__delta is-up"><ArrowUp size={10} strokeWidth={2.4} /> +18% vs last period</div>
            <div style={{ marginTop: 8 }}><Sparkline values={tokens} color="var(--accent-purple)" /></div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Analysis minutes</div>
            <div className="demo-stat__value">8,204</div>
            <div className="demo-stat__delta is-up"><ArrowUp size={10} strokeWidth={2.4} /> +4% vs last period</div>
            <div style={{ marginTop: 8 }}><Sparkline values={minutes} color="var(--accent)" /></div>
          </div>
          <div className="demo-stat">
            <div className="demo-stat__label">Active seats</div>
            <div className="demo-stat__value">12 / 25</div>
            <div className="demo-stat__delta is-down"><ArrowDown size={10} strokeWidth={2.4} /> -1 vs last period</div>
            <div style={{ marginTop: 8 }}><Sparkline values={seats} /></div>
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Quota</div>
              <div className="demo-block__sub">Soft caps — overage is billed at the on-demand rate.</div>
            </div>
          </header>
          <div className="demo-block__body">
            <div style={{ display: "grid", gridTemplateColumns: "200px minmax(0,1fr) 100px", gap: 12, alignItems: "center", fontSize: "var(--fs-xs)" }}>
              <div>AI tokens</div>
              <div className="demo-progress demo-progress--accent"><div className="demo-progress__bar"><div className="demo-progress__fill" style={{ width: "71%" }} /></div></div>
              <div className="is-num" style={{ fontFamily: "var(--font-mono)", textAlign: "right" }}>1.42M / 2M</div>

              <div style={{ marginTop: 8 }}>Analysis minutes</div>
              <div className="demo-progress" style={{ marginTop: 8 }}><div className="demo-progress__bar"><div className="demo-progress__fill" style={{ width: "41%" }} /></div></div>
              <div className="is-num" style={{ fontFamily: "var(--font-mono)", textAlign: "right", marginTop: 8 }}>8.2k / 20k</div>

              <div style={{ marginTop: 8 }}>Seats</div>
              <div className="demo-progress demo-progress--warn" style={{ marginTop: 8 }}><div className="demo-progress__bar"><div className="demo-progress__fill" style={{ width: "48%" }} /></div></div>
              <div className="is-num" style={{ fontFamily: "var(--font-mono)", textAlign: "right", marginTop: 8 }}>12 / 25</div>

              <div style={{ marginTop: 8 }}>Webhook deliveries</div>
              <div className="demo-progress demo-progress--danger" style={{ marginTop: 8 }}><div className="demo-progress__bar"><div className="demo-progress__fill" style={{ width: "93%" }} /></div></div>
              <div className="is-num" style={{ fontFamily: "var(--font-mono)", textAlign: "right", marginTop: 8 }}>46.7k / 50k</div>
            </div>
          </div>
        </div>

        <div className="demo-block">
          <header className="demo-block__head">
            <div>
              <div className="demo-block__title">Heaviest users</div>
              <div className="demo-block__sub">By AI tokens consumed this period.</div>
            </div>
          </header>
          <div className="demo-block__body demo-block__body--flush">
            <table className="demo-table">
              <thead>
                <tr>
                  <th>Member</th>
                  <th className="is-num" style={{ textAlign: "right" }}>Tokens</th>
                  <th className="is-num" style={{ textAlign: "right" }}>Minutes</th>
                  <th className="is-num" style={{ textAlign: "right" }}>Runs</th>
                </tr>
              </thead>
              <tbody>
                {[
                  { name: "Ada Lovelace",      t: "412k", m: "1,834", r: "126" },
                  { name: "Alan Turing",       t: "301k", m: "1,212", r: "89" },
                  { name: "Grace Hopper",      t: "244k", m: "992",   r: "71" },
                  { name: "Linus Torvalds",    t: "198k", m: "842",   r: "58" },
                  { name: "Donald Knuth",      t: "143k", m: "601",   r: "41" },
                ].map((r) => (
                  <tr key={r.name}>
                    <td>{r.name}</td>
                    <td className="is-num">{r.t}</td>
                    <td className="is-num">{r.m}</td>
                    <td className="is-num">{r.r}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
